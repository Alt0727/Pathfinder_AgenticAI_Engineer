// Reads + checks env vars (apps/listener/.env, loaded by `node --env-file=.env`).
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'INGEST_URL', 'INGEST_SECRET', 'GEMINI_API_KEY', 'GEMINI_MODEL']
// Needed once the planner agent (AI #2) is deployed; empty = no fan-out.
const LATER = ['AGENT_URL', 'AGENT_SECRET']
// Optional: a second model used on the last retry when the main one is overloaded.
const OPTIONAL = ['GEMINI_FALLBACK_MODEL']

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
  geminiFallbackModel: process.env[OPTIONAL[0]] || null,
  agentUrl: process.env.AGENT_URL,
  agentSecret: process.env.AGENT_SECRET,
}
