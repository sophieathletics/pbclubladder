import { Resend } from "resend";
import { logger } from "./logger";

const APP_URL = process.env.APP_URL ?? "https://pbclubladder.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const FROM_EMAIL = process.env.FROM_EMAIL ?? "Pickleball Club Ladder <noreply@pbclubladder.com>";
const CLUB_NAME = "Pickleball Club Ladder";

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  const resend = getResend();
  if (!resend) {
    logger.warn({ to: payload.to, subject: payload.subject }, "RESEND_API_KEY not set, email not sent");
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
    });
    if (error) {
      logger.error({ err: error, subject: payload.subject }, "Failed to send email");
    }
  } catch (err) {
    logger.error({ err }, "Error sending email");
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function baseTemplate(content: string, ctaText?: string, ctaUrl?: string): string {
  const cta = ctaText && ctaUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0"><tr><td align="center" bgcolor="#16a34a" style="border-radius:8px"><a href="${ctaUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">${ctaText}</a></td></tr></table>`
    : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f7f6;padding:32px 16px"><tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <tr><td style="background:linear-gradient(135deg,#16a34a,#15803d);padding:28px 32px;text-align:center">
      <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px">${CLUB_NAME}</div>
    </td></tr>
    <tr><td style="padding:32px;font-size:15px;line-height:1.6;color:#1f2937">
      ${content}
      ${cta}
    </td></tr>
    <tr><td style="padding:18px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center">
      You're receiving this email from ${CLUB_NAME}. If this wasn't meant for you, you can safely ignore it.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export async function sendTeamInvitationEmail(to: string, inviterName: string, teamName: string, seasonName: string): Promise<void> {
  const redirect = encodeURIComponent("/team");
  const emailParam = encodeURIComponent(to);
  const ctaUrl = `${APP_URL}/register?redirect=${redirect}&email=${emailParam}`;
  sendEmail({
    to,
    subject: `You've been invited to join a team on the Pickleball Ladder`,
    html: baseTemplate(
      `<h2 style="margin:0 0 12px;font-size:22px;color:#111827">You're invited to join a team!</h2>
<p style="margin:0 0 12px"><strong>${escapeHtml(inviterName)}</strong> has invited you to form a team called <strong>${escapeHtml(teamName)}</strong> for the <strong>${escapeHtml(seasonName)}</strong> season.</p>
<p style="margin:0 0 8px;color:#4b5563">Click below to create your free account — you'll be taken straight to the invitation so you can accept and start competing.</p>`,
      "View Invitation",
      ctaUrl
    ),
  });
}

export async function sendExistingUserInvitationEmail(to: string, inviterName: string, teamName: string, seasonName: string): Promise<void> {
  sendEmail({
    to,
    subject: `You've been invited to join a team on PB Club Ladder`,
    html: baseTemplate(
      `<h2 style="margin:0 0 12px;font-size:22px;color:#111827">You're invited to join a team!</h2>
<p style="margin:0 0 12px"><strong>${escapeHtml(inviterName)}</strong> has invited you to form a team called <strong>${escapeHtml(teamName)}</strong> for the <strong>${escapeHtml(seasonName)}</strong> season.</p>
<p style="margin:0 0 8px;color:#4b5563">Log in to accept your invitation and start competing.</p>`,
      "Log In to Accept",
      `${APP_URL}/login?redirect=${encodeURIComponent("/team")}`
    ),
  });
}

export async function sendInvitationAcceptedEmail(to: string, partnerName: string, teamName: string): Promise<void> {
  sendEmail({
    to,
    subject: `${partnerName} accepted your team invitation!`,
    html: baseTemplate(`<p>${partnerName} accepted your invitation! Your team <strong>${teamName}</strong> is now active and placed on the ladder.</p>`, "View Team", `${APP_URL}/team`),
  });
}

export async function sendInvitationDeclinedEmail(to: string, partnerName: string): Promise<void> {
  sendEmail({
    to,
    subject: `${partnerName} declined your team invitation`,
    html: baseTemplate(`<p>${partnerName} declined your invitation. You can invite another player to form a team.</p>`, "Find a Partner", `${APP_URL}/team`),
  });
}

export async function sendChallengeReceivedEmail(to: string | string[], challengerTeam: string, challengerPos: number, challengedPos: number, challengeId: string): Promise<void> {
  sendEmail({
    to,
    subject: `${challengerTeam} has challenged your team!`,
    html: baseTemplate(
      `<p><strong>${challengerTeam}</strong> (Position #${challengerPos}) has challenged your team (Position #${challengedPos}). Accept or decline within 48 hours.</p>`,
      "View Challenge",
      `${APP_URL}/challenges/${challengeId}`
    ),
  });
}

export async function sendChallengeAcceptedEmail(to: string | string[], challengedTeam: string, challengeId: string): Promise<void> {
  sendEmail({
    to,
    subject: `${challengedTeam} accepted your challenge!`,
    html: baseTemplate(`<p>${challengedTeam} accepted your challenge! Please submit your availability to schedule the match.</p>`, "Submit Availability", `${APP_URL}/availability/${challengeId}`),
  });
}

export async function sendChallengeDeclinedEmail(to: string | string[], challengedTeam: string): Promise<void> {
  sendEmail({ to, subject: `${challengedTeam} declined your challenge`, html: baseTemplate(`<p>${challengedTeam} declined your challenge. You are free to send a new challenge.</p>`, "Challenge a Team", `${APP_URL}/challenge`) });
}

export async function sendAvailabilitySubmittedEmail(to: string | string[], teamName: string, challengeId: string): Promise<void> {
  sendEmail({
    to,
    subject: `${teamName} submitted their availability`,
    html: baseTemplate(`<p>${teamName} has submitted their availability. Please submit your availability so we can find a common time.</p>`, "Submit Availability", `${APP_URL}/availability/${challengeId}`),
  });
}

function formatEmailDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatEmailTime(timeStr: string): string {
  const [h] = timeStr.split(":");
  const hour = parseInt(h, 10);
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export async function sendCommonAvailabilityEmail(to: string | string[], slots: Array<{ date: string; times: string[] }>, challengeId: string): Promise<void> {
  const dateBlocks = slots.map(s => {
    const pills = s.times.map(t =>
      `<span style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:6px 14px;border-radius:20px;font-size:14px;font-weight:500">${formatEmailTime(t)}</span>`
    ).join(" ");
    return `<div style="margin-bottom:20px">
  <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#16a34a;margin-bottom:10px">${formatEmailDate(s.date)}</div>
  <div style="display:flex;flex-wrap:wrap;gap:8px">${pills}</div>
</div>`;
  }).join("");

  sendEmail({
    to,
    subject: `Common availability found — book your court!`,
    html: baseTemplate(
      `<h2 style="margin:0 0 8px;font-size:20px;color:#111827">Common availability found!</h2>
<p style="margin:0 0 24px;color:#4b5563">Both teams are free at these times. Head to the app to pick a slot and confirm your match.</p>
${dateBlocks}`,
      "Book Match",
      `${APP_URL}/challenges/${challengeId}`
    ),
  });
}

export async function sendNoCommonAvailabilityEmail(to: string | string[], team1Players: string, team2Players: string): Promise<void> {
  sendEmail({
    to,
    subject: `No common availability found — please coordinate directly`,
    html: baseTemplate(`<p>No overlapping time slots were found. Contact each other to arrange a match.</p><p><strong>Team 1:</strong> ${team1Players}</p><p><strong>Team 2:</strong> ${team2Players}</p>`),
  });
}

export async function sendMatchScheduledEmail(to: string | string[], date: string, time: string, location: string, team1: string, team2: string): Promise<void> {
  sendEmail({
    to,
    subject: `Match confirmed — ${date} at ${time}, ${location}`,
    html: baseTemplate(`<p>Your match has been confirmed!</p><ul><li><strong>Date:</strong> ${date}</li><li><strong>Time:</strong> ${time}</li><li><strong>Location:</strong> ${location}</li><li><strong>Teams:</strong> ${team1} vs ${team2}</li></ul>`),
  });
}

export async function sendScoreSubmittedEmail(to: string | string[], submittingTeam: string, scoreStr: string, matchId: string): Promise<void> {
  sendEmail({
    to,
    subject: `Please confirm the match score`,
    html: baseTemplate(
      `<p>${submittingTeam} entered the following score: ${scoreStr}. You have 48 hours to confirm or dispute. After 48 hours it will auto-confirm.</p>`,
      "View Score",
      `${APP_URL}/matches/${matchId}`
    ),
  });
}

export async function sendScoreConfirmedEmail(to: string | string[], winner: string, scoreStr: string, matchId: string): Promise<void> {
  sendEmail({
    to,
    subject: `Match result confirmed — rankings updated`,
    html: baseTemplate(`<p>Match result confirmed. Winner: <strong>${winner}</strong>. Score: ${scoreStr}. Rankings have been updated.</p>`, "View Match", `${APP_URL}/matches/${matchId}`),
  });
}

export async function sendScoreAutoConfirmedEmail(to: string | string[], winner: string, scoreStr: string, matchId: string): Promise<void> {
  sendEmail({
    to,
    subject: `Match result auto-confirmed after 48 hours`,
    html: baseTemplate(`<p>Match result auto-confirmed. Winner: <strong>${winner}</strong>. Score: ${scoreStr}. Rankings have been updated.</p>`, "View Match", `${APP_URL}/matches/${matchId}`),
  });
}

export async function sendDisputeFiledEmail(team1: string, team2: string, scoreStr: string, reason: string, disputeId: string, contacts: string): Promise<void> {
  sendEmail({
    to: ADMIN_EMAIL,
    subject: `Score dispute filed — action required`,
    html: baseTemplate(
      `<p>A score dispute has been filed.</p><ul><li><strong>Teams:</strong> ${team1} vs ${team2}</li><li><strong>Score:</strong> ${scoreStr}</li><li><strong>Reason:</strong> ${reason}</li><li><strong>Contacts:</strong> ${contacts}</li></ul>`,
      "Resolve Dispute",
      `${APP_URL}/admin/disputes`
    ),
  });
}

export async function sendDisputeResolvedEmail(to: string | string[], decision: string, matchId: string): Promise<void> {
  sendEmail({
    to,
    subject: `Your match dispute has been resolved`,
    html: baseTemplate(`<p>Your match dispute has been resolved by the admin. Decision: ${decision}.</p>`, "View Match", `${APP_URL}/matches/${matchId}`),
  });
}

export async function sendInactivityDropEmail(to: string | string[], oldPos: number, newPos: number): Promise<void> {
  sendEmail({
    to,
    subject: `Your team dropped 1 spot due to inactivity`,
    html: baseTemplate(`<p>Your team has not played a match in 14 days and has dropped from position #${oldPos} to position #${newPos}. Challenge a team to stay competitive!</p>`, "Challenge a Team", `${APP_URL}/challenge`),
  });
}

export async function sendChallengeExpiredEmail(to: string | string[], challengedTeam: string): Promise<void> {
  sendEmail({
    to,
    subject: `Your challenge expired — no response received`,
    html: baseTemplate(`<p>${challengedTeam} did not respond within 48 hours. You are free to send a new challenge.</p>`, "Challenge a Team", `${APP_URL}/challenge`),
  });
}

export async function sendPaymentReminderEmail(to: string | string[], teamName: string, daysLeft: number, teamId: string): Promise<void> {
  sendEmail({
    to,
    subject: `Reminder: pay your entry fee for "${teamName}"`,
    html: baseTemplate(
      `<p>Your team "${teamName}" still has an unpaid entry fee. Both teammates must pay within <strong>${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong> or the team will be auto-dissolved.</p>`,
      "Pay Now",
      `${APP_URL}/team`
    ),
  });
}

export async function sendTeamAutoDissolvedEmail(to: string | string[], teamName: string): Promise<void> {
  sendEmail({
    to,
    subject: `Team "${teamName}" was dissolved (unpaid entry fee)`,
    html: baseTemplate(
      `<p>Your team "${teamName}" was dissolved because the entry fee was not paid within 5 days of the team being formed. If anyone had paid, that payment has been refunded to their card. You're welcome to form a new team any time.</p>`,
      "Back to App",
      `${APP_URL}/`
    ),
  });
}

export async function sendTeamWithdrawnEmail(to: string | string[], teamName: string, withdrawerName: string, refundAmountCents: number | null): Promise<void> {
  const refundLine = refundAmountCents != null && refundAmountCents > 0
    ? `<p>Your entry fee of $${(refundAmountCents / 100).toFixed(2)} has been refunded to your card and should appear in 5–10 business days.</p>`
    : "";
  sendEmail({
    to,
    subject: `Your teammate withdrew — team "${teamName}" dissolved`,
    html: baseTemplate(
      `<p>${withdrawerName} has withdrawn from your team "${teamName}", so the team has been dissolved.</p>${refundLine}<p>You're welcome to form a new team any time.</p>`,
      "Back to App",
      `${APP_URL}/`
    ),
  });
}

export async function sendWithdrawalConfirmationEmail(to: string, teamName: string, refundAmountCents: number | null): Promise<void> {
  const refundLine = refundAmountCents != null && refundAmountCents > 0
    ? `<p>Your entry fee of $${(refundAmountCents / 100).toFixed(2)} has been refunded to your card and should appear in 5–10 business days.</p>`
    : "";
  sendEmail({
    to,
    subject: `You withdrew from team "${teamName}"`,
    html: baseTemplate(
      `<p>You've successfully withdrawn from team "${teamName}". The team has been dissolved.</p>${refundLine}`,
      "Back to App",
      `${APP_URL}/`
    ),
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to,
    subject: `Reset your Pickleball Club Ladder password`,
    html: baseTemplate(
      `<p>We received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.</p><p style="color:#6b7280;font-size:13px">If you didn't request this, you can safely ignore this email — your password won't change.</p>`,
      "Reset Password",
      resetUrl
    ),
  });
}

export async function sendAdminRemovedTeamEmail(to: string | string[], teamName: string, refundAmountCents: number | null): Promise<void> {
  const refundLine = refundAmountCents != null && refundAmountCents > 0
    ? `<p>Your entry fee of $${(refundAmountCents / 100).toFixed(2)} has been refunded to your card and should appear in 5–10 business days.</p>`
    : "";
  sendEmail({
    to,
    subject: `Your team "${teamName}" was removed by an administrator`,
    html: baseTemplate(
      `<p>An administrator has removed your team "${teamName}" from the ladder.</p>${refundLine}<p>If you have questions, please contact the ladder organizer.</p>`,
      "Back to App",
      `${APP_URL}/`
    ),
  });
}
