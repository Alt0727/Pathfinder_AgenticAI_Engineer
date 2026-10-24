// Reads + checks env vars (apps/listener/.env, loaded by `node --env-file=.env`).
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'INGEST_URL', 'INGEST_SECRET']
// Needed from build step 6 (AI #1) / 7 (AI #2); empty is fine until then.
const LATER = ['GEMINI_API_KEY', 'GEMINI_MODEL', 'AGENT_URL', 'AGENT_SECRET']

const missing = REQUIRED.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Missing env vars in apps/listener/.env: ${missing.join(', ')}`)
  process.exit(1)
}
const notYet = LATER.filter((k) => !process.env[k])
if (notYet.length) console.log(`(not set yet: ${notYet.join(', ')})`)

export const config = {
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY,
  ingestUrl: process.env.INGEST_URL,
  ingestSecret: process.env.INGEST_SECRET,
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL,
  agentUrl: process.env.AGENT_URL,
  agentSecret: process.env.AGENT_SECRET,
}
