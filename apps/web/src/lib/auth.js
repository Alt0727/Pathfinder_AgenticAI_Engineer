/*
  auth.js
  The sign-in call behind the landing page's "Sign in →". unmute uses anonymous
  accounts: no email, password or name. The first visit creates one; later
  visits reuse the saved session (same browser = same account). Throws a
  readable Error on failure; the sign-in card shows it.
*/
import { ensureSession } from "@/lib/session"

export async function signIn() {
  try {
    await ensureSession()
  } catch {
    throw new Error("Couldn't sign you in. Check your connection and try again.")
  }
}
