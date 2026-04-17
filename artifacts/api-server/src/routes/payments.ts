import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { db, teamsTable, seasonsTable, laddersTable, playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getStripe, getWebhookSecret, isStripeConfigured } from "../lib/stripe";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Mark a specific player as paid, and if both teammates have paid, mark the team paid.
async function markPlayerPaid(teamId: string, payerId: string, paymentIntentId: string) {
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team) return;

  const patch: any = {};
  if (team.player1Id === payerId && !team.player1PaidAt) {
    patch.player1PaidAt = new Date();
    patch.player1StripePaymentIntentId = paymentIntentId;
  } else if (team.player2Id === payerId && !team.player2PaidAt) {
    patch.player2PaidAt = new Date();
    patch.player2StripePaymentIntentId = paymentIntentId;
  }

  const bothPaid =
    (team.player1PaidAt || patch.player1PaidAt) && (team.player2PaidAt || patch.player2PaidAt);
  if (bothPaid && team.paymentStatus !== "paid") {
    patch.paymentStatus = "paid";
  }

  if (Object.keys(patch).length > 0) {
    await db.update(teamsTable).set(patch).where(eq(teamsTable.id, teamId));
    logger.info({ teamId, payerId, paymentIntentId, bothPaid }, "Player marked paid");
  }
}

// Webhook MUST receive raw body.
router.post(
  "/payments/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response): Promise<void> => {
    if (!isStripeConfigured()) {
      res.status(503).json({ error: "Stripe not configured" });
      return;
    }
    const stripe = getStripe();
    const sig = req.headers["stripe-signature"];
    const secret = getWebhookSecret();

    let event;
    try {
      if (secret && sig) {
        event = stripe.webhooks.constructEvent(req.body as Buffer, sig as string, secret);
      } else {
        event = JSON.parse((req.body as Buffer).toString("utf8"));
        logger.warn("Stripe webhook signature not verified (no secret or signature)");
      }
    } catch (err: any) {
      logger.error({ err: err?.message }, "Stripe webhook signature verification failed");
      res.status(400).send(`Webhook Error: ${err?.message}`);
      return;
    }

    try {
      if (event.type === "payment_intent.succeeded") {
        const pi = event.data.object;
        const teamId = pi.metadata?.teamId;
        const payerId = pi.metadata?.payerId;
        if (teamId && payerId) {
          await markPlayerPaid(teamId, payerId, pi.id);
        }
      } else if (event.type === "payment_intent.payment_failed") {
        const pi = event.data.object;
        logger.warn({ teamId: pi.metadata?.teamId, payerId: pi.metadata?.payerId, paymentIntentId: pi.id }, "Payment failed");
      }
    } catch (err: any) {
      logger.error({ err: err?.message }, "Webhook handler error");
    }

    res.json({ received: true });
  }
);

// Create a PaymentIntent for the CURRENT player's share of the entry fee.
router.post("/payments/create-intent", express.json(), requireAuth, async (req, res): Promise<void> => {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Payments are not configured on this server" });
    return;
  }
  const player = (req as any).player;
  const { teamId } = req.body as { teamId?: string };
  if (!teamId) {
    res.status(400).json({ error: "teamId is required" });
    return;
  }

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  const isPlayer1 = team.player1Id === player.id;
  const isPlayer2 = team.player2Id === player.id;
  if (!isPlayer1 && !isPlayer2) {
    res.status(403).json({ error: "You are not on this team" });
    return;
  }

  const myPaidAt = isPlayer1 ? team.player1PaidAt : team.player2PaidAt;
  if (myPaidAt) {
    res.status(400).json({ error: "You have already paid your entry fee" });
    return;
  }

  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, team.seasonId)).limit(1);
  if (!season) {
    res.status(404).json({ error: "Season not found" });
    return;
  }
  const [ladder] = await db.select().from(laddersTable).where(eq(laddersTable.id, season.ladderId)).limit(1);
  if (!ladder || ladder.entryFeeCents == null || ladder.entryFeeCents <= 0) {
    res.status(400).json({ error: "This ladder has no entry fee" });
    return;
  }

  const stripe = getStripe();
  const myIntentId = isPlayer1 ? team.player1StripePaymentIntentId : team.player2StripePaymentIntentId;

  // Reuse existing intent if it's still actionable
  if (myIntentId) {
    try {
      const existing = await stripe.paymentIntents.retrieve(myIntentId);
      if (
        existing.status === "requires_payment_method" ||
        existing.status === "requires_confirmation" ||
        existing.status === "requires_action"
      ) {
        res.json({
          clientSecret: existing.client_secret,
          amount: existing.amount,
          currency: existing.currency,
          ladderName: ladder.name,
          teamName: team.teamName,
        });
        return;
      }
      if (existing.status === "succeeded") {
        await markPlayerPaid(team.id, player.id, existing.id);
        res.status(400).json({ error: "You have already paid your entry fee" });
        return;
      }
    } catch (err: any) {
      logger.warn({ err: err?.message }, "Failed to retrieve existing PaymentIntent; creating new one");
    }
  }

  const intent = await stripe.paymentIntents.create({
    amount: ladder.entryFeeCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    description: `${ladder.name} entry fee — ${player.fullName}`,
    metadata: {
      teamId: team.id,
      ladderId: ladder.id,
      seasonId: season.id,
      payerId: player.id,
    },
  });

  const patch: any = {};
  if (isPlayer1) patch.player1StripePaymentIntentId = intent.id;
  else patch.player2StripePaymentIntentId = intent.id;
  await db.update(teamsTable).set(patch).where(eq(teamsTable.id, team.id));

  res.json({
    clientSecret: intent.client_secret,
    amount: intent.amount,
    currency: intent.currency,
    ladderName: ladder.name,
    teamName: team.teamName,
  });
});

// Client-triggered sync (defensive — webhook is source of truth) for the CURRENT player.
router.post("/payments/sync/:teamId", express.json(), requireAuth, async (req, res): Promise<void> => {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Stripe not configured" });
    return;
  }
  const player = (req as any).player;
  const teamId = Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId;

  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  const isPlayer1 = team.player1Id === player.id;
  const isPlayer2 = team.player2Id === player.id;
  if (!isPlayer1 && !isPlayer2) {
    res.status(403).json({ error: "You are not on this team" });
    return;
  }
  const myIntentId = isPlayer1 ? team.player1StripePaymentIntentId : team.player2StripePaymentIntentId;
  if (!myIntentId) {
    res.json({ paymentStatus: team.paymentStatus });
    return;
  }
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(myIntentId);
  if (pi.status === "succeeded") {
    await markPlayerPaid(team.id, player.id, pi.id);
    const [fresh] = await db.select().from(teamsTable).where(eq(teamsTable.id, team.id)).limit(1);
    res.json({ paymentStatus: fresh?.paymentStatus, myPaid: true });
    return;
  }
  res.json({ paymentStatus: team.paymentStatus, stripeStatus: pi.status });
});

export default router;
