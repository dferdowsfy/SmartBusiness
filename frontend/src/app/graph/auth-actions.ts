// Server-side actions that bridge Supabase auth into the capture schema:
//   * upsertUser            — mirror the auth user into our `users` table
//   * claimSubmissionsByEmail — adopt anonymous submissions that match the
//     user's email (the "save this submission" flow before sign-in)
//
// Anonymous use stays fully supported — these are pure best-effort writes.

import { getPool, isEnabled } from "./db";

export async function upsertUser(
  userId: string,
  email: string | null,
  name: string | null
): Promise<void> {
  if (!isEnabled()) return;
  const pool = getPool();
  if (!pool) return;
  try {
    await pool.query(
      `INSERT INTO users (id, email, name, last_login) VALUES ($1,$2,$3, now())
       ON CONFLICT (id) DO UPDATE SET
         email = COALESCE(EXCLUDED.email, users.email),
         name  = COALESCE(EXCLUDED.name,  users.name),
         last_login = now()`,
      [userId, email, name]
    );
  } catch (err) {
    console.error("[auth] upsertUser failed:", (err as Error).message);
  }
}

// Adopt anonymous submissions that share the user's email and have no owner.
export async function claimSubmissionsByEmail(
  userId: string,
  email: string | null
): Promise<number> {
  if (!isEnabled() || !email) return 0;
  const pool = getPool();
  if (!pool) return 0;
  try {
    const sub = await pool.query(
      `UPDATE submissions SET user_id = $1
         WHERE user_id IS NULL AND lower(claim_email) = lower($2)
       RETURNING id`,
      [userId, email]
    );
    if (sub.rowCount && sub.rowCount > 0) {
      const ids = sub.rows.map((r: { id: string }) => r.id);
      // Propagate ownership to dependent rows.
      await pool.query(
        `UPDATE document_validations SET user_id = $1 WHERE submission_id = ANY($2::uuid[]) AND user_id IS NULL`,
        [userId, ids]
      );
      await pool.query(
        `UPDATE readiness_scores SET user_id = $1 WHERE submission_id = ANY($2::uuid[]) AND user_id IS NULL`,
        [userId, ids]
      );
    }
    return sub.rowCount || 0;
  } catch (err) {
    console.error("[auth] claim failed:", (err as Error).message);
    return 0;
  }
}
