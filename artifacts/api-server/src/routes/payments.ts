import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { db, teamsTable, seasonsTable, laddersTable, playersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { getStripe, getWebhookSecret, isStripeConfigured } from "../lib/stripe";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Webhook MUST receive raw body. This route is also mounted with raw parser
// at the app level to ensure express.json() doesn't consume the body first.
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
        // Dev fallback: parse raw JSON without verification
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
        if (teamId) {
          await db.update(teamsTable)
            .set({ paymentStatus: "paid", stripePaymentIntentId: pi.id })
            .where(eq(teamsTable.id, teamId));
          logger.info({ teamId, paymentIntentId: pi.id }, "Team marked paid via webhook");
        }
      } else if (event.type === "payment_intent.payment_failed") {
        const pi = event.data.object;
        const teamId = pi.metadata?.teamId;
        logger.warn({ teamId, paymentIntentId: pi.id }, "Payment failed");
      }
    } catch (err: any) {
      logger.error({ err: err?.message }, "Webhook handler error");
    }

    res.json({ received: true });
  }
);

// Create a PaymentIntent for a team's entry fee
// NOTE: This router is mounted BEFORE express.json() (so the webhook can use raw body),
// so JSON-bodied routes need express.json() applied per-route.
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
  if (team.player1Id !== player.id && team.player2Id !== player.id) {
    res.status(403).json({ error: "You are not on this team" });
    return;
  }
  if (team.paymentStatus === "paid") {
    res.status(400).json({ error: "This team has already been paid for" });
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

  // Reuse existing intent if it's still actionable
  if (team.stripePaymentIntentId) {
    try {
      const existing = await stripe.paymentIntents.retrieve(team.stripePaymentIntentId);
      if (existing.status === "requires_payment_method" || existing.status === "requires_confirmation" || existing.status === "requires_action") {
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
        await db.update(teamsTable).set({ paymentStatus: "paid" }).where(eq(teamsTable.id, team.id));
        res.status(400).json({ error: "Already paid" });
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
    description: `${ladder.name} entry fee — Team ${team.teamName}`,
    metadata: {
      teamId: team.id,
      ladderId: ladder.id,
      seasonId: season.id,
      payerId: player.id,
    },
  });

  await db.update(teamsTable)
    .set({ stripePaymentIntentId: intent.id })
    .where(eq(teamsTable.id, team.id));

  res.json({
    clientSecret: intent.client_secret,
    amount: intent.amount,
    currency: intent.currency,
    ladderName: ladder.name,
    teamName: team.teamName,
  });
});

// Allow client to confirm-by-poll after redirect (defensive — webhook is source of truth)
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
  if (team.player1Id !== player.id && team.player2Id !== player.id) {
    res.status(403).json({ error: "You are not on this team" });
    return;
  }
  if (!team.stripePaymentIntentId) {
    res.json({ paymentStatus: team.paymentStatus });
    return;
  }
  const stripe = getStripe();
  const pi = await stripe.paymentIntents.retrieve(team.stripePaymentIntentId);
  if (pi.status === "succeeded" && team.paymentStatus !== "paid") {
    await db.update(teamsTable).set({ paymentStatus: "paid" }).where(eq(teamsTable.id, team.id));
    res.json({ paymentStatus: "paid" });
    return;
  }
  res.json({ paymentStatus: team.paymentStatus, stripeStatus: pi.status });
});

export default router;
