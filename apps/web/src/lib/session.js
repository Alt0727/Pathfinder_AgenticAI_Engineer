import { supabase } from '@/lib/supabase'

// One shared promise: React StrictMode runs effects twice in dev, and two parallel calls
// would create two anonymous users on the very first visit.
let pending = null

// The saved session, only if its user still exists on the server. After a full reset (users
// deleted) the browser still holds the old login: drop it locally so a fresh sign-in can happen.
export async function validSession() {
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null
  const { error } = await supabase.auth.getUser()   // asks the server, not localStorage
  if (!error) return data.session
  await supabase.auth.signOut({ scope: 'local' })
  return null
}

// Reuse a valid saved session, else sign in anonymously (a new user, nothing personal stored).
export function ensureSession() {
  if (!pending) {
    pending = (async () => {
      const session = await validSession()
      if (session) return session

      const res = await supabase.auth.signInAnonymously()
      if (res.error) throw res.error
      return res.data.session
    })()
    pending.catch(() => { pending = null })   // allow a retry after a failure
  }
  return pending
}
