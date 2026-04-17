import { Client } from "pg";
import { createHmac, randomBytes } from "crypto";

const ADMIN_EMAIL = "sophie@sophieathletics.com";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHmac("sha256", salt).update(password).digest("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const url = process.env.PROD_DATABASE_URL;
  const password = process.env.PROD_ADMIN_PASSWORD;
  if (!url) throw new Error("PROD_DATABASE_URL not set");
  if (!password) throw new Error("PROD_ADMIN_PASSWORD not set");

  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const existing = await client.query("SELECT id, role FROM players WHERE email = $1", [ADMIN_EMAIL]);
    if (existing.rows.length > 0) {
      const id = existing.rows[0].id;
      await client.query(
        `UPDATE players SET password_hash = $1, role = 'admin', is_active = true,
           full_name = COALESCE(NULLIF(full_name, ''), 'Sophie'),
           first_name = COALESCE(first_name, 'Sophie')
         WHERE id = $2`,
        [hashPassword(password), id]
      );
      console.log(`Admin already existed (id=${id}); password reset and role ensured.`);
    } else {
      const r = await client.query(
        `INSERT INTO players (full_name, first_name, email, password_hash, role, is_active, share_contact)
         VALUES ('Sophie', 'Sophie', $1, $2, 'admin', true, false)
         RETURNING id`,
        [ADMIN_EMAIL, hashPassword(password)]
      );
      console.log(`Created admin (id=${r.rows[0].id}, email=${ADMIN_EMAIL}).`);
    }

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM players) AS players,
        (SELECT COUNT(*)::int FROM ladders) AS ladders,
        (SELECT COUNT(*)::int FROM seasons) AS seasons,
        (SELECT COUNT(*)::int FROM teams) AS teams
    `);
    console.log("Production DB row counts:", counts.rows[0]);
  } finally {
    await client.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
