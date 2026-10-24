import { db } from './supabase.ts'

// Verifies the browser's login token with Supabase Auth → the user id, or null (→ 401).
// The user id ALWAYS comes from here, never from the request body.
export async function getUserFromRequest(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await db.auth.getUser(token)
  return error || !data.user ? null : data.user.id
}
