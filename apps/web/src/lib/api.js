import { supabase } from '@/lib/supabase'
import { ensureSession } from '@/lib/session'

const URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/app-api`

// Every write goes through here: api('entry.add', { title, starts_at }).
// Sends the login token; app-api takes the user id from it. Never throws: always { ok, ... }.
export async function api(action, params = {}) {
  await ensureSession()
  const { data } = await supabase.auth.getSession()   // the current (auto-refreshed) token
  if (!data.session) return { ok: false, error: 'not signed in' }

  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ action, ...params }),
    })
    return await res.json()
  } catch {
    return { ok: false, error: 'network error' }
  }
}
