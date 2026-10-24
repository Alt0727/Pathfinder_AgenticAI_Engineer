import { createClient } from '@supabase/supabase-js'

// Browser client: publishable key only. RLS decides what it can read; it can't write any table.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in apps/web/.env.local')
}

export const supabase = createClient(url, key)
