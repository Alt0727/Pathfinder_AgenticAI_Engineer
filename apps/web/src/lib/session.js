import { supabase } from '@/lib/supabase'

// One shared promise: React StrictMode runs effects twice in dev, and two parallel calls
// would create two anonymous users on the very first visit.
let pending = null

// Reuse the saved session (supabase-js keeps it in localStorage), else sign in anonymously.
export function ensureSession() {
  if (!pending) {
    pending = (async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      if (data.session) return data.session

      const res = await supabase.auth.signInAnonymously()
      if (res.error) throw res.error
      return res.data.session
    })()
    pending.catch(() => { pending = null })   // allow a retry after a failure
  }
  return pending
}
