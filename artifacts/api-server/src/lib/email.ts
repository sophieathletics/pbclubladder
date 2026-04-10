import { logger } from "./logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const FROM_EMAIL = process.env.FROM_EMAIL ?? "Pickleball Club Ladder <noreply@pickleballclubladder.com>";
const CLUB_NAME = "Pickleball Club Ladder";

interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!RESEND_API_KEY) {
    logger.warn({ to: payload.to, subject: payload.subject }, "RESEND_API_KEY not set, email not sent");
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(payload.to) ? payload.to : [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      logger.error({ err, subject: payload.subject }, "Failed to send email");
    }
  } catch (err) {
    logger.error({ err }, "Error sending email");
  }
}

function baseTemplate(content: string, ctaText?: string, ctaUrl?: string): string {
  const cta = ctaText && ctaUrl ? `<a href="${ctaUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:16px">${ctaText}</a>` : "";
  return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px"><h2 style="color:#15803d">${CLUB_NAME}</h2>${content}${cta}<hr style="margin:24px 0"/><p style="color:#6b7280;font-size:12px">You received this email because you are a member of ${CLUB_NAME}.</p></div>`;
}

export async function sendTeamInvitationEmail(to: string, inviterName: string, teamName: string, seasonName: string): Promise<void> {
  sendEmail({
    to,
    subject: `You've been invited to join a team on the Pickleball Ladder`,
    html: baseTemplate(
      `<p>${inviterName} has invited you to form a team called <strong>${teamName}</strong> for the <strong>${seasonName}</strong> season. Accept or decline below.</p>`,
      "View Invitation",
      `${APP_URL}/team`
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

export async function sendCommonAvailabilityEmail(to: string | string[], slots: string[], challengeId: string): Promise<void> {
  const slotList = slots.map(s => `<li>${s}</li>`).join("");
  sendEmail({
    to,
    subject: `Common availability found — book your court!`,
    html: baseTemplate(`<p>You have overlapping availability on these dates/times:</p><ul>${slotList}</ul><p>Please confirm a time and book a court.</p>`, "Book Match", `${APP_URL}/challenges/${challengeId}`),
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
