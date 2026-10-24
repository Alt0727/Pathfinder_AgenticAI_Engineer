import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

// Laptop client with the secret key (bypasses RLS). Never shipped to a browser.
export const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
