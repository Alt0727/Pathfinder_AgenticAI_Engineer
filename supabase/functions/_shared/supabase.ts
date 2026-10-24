import { createClient } from 'npm:@supabase/supabase-js@2'

// Service client: uses the secret key, so it bypasses RLS. Server-side only, never sent to a browser.
// SB_SECRET_KEY (an sb_secret_… key) wins if set; otherwise the built-in service role key.
const url = Deno.env.get('SUPABASE_URL')
const key = Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!url || !key) throw new Error('Missing SUPABASE_URL or a secret key')

export const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})
