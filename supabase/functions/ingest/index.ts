// ingest: the listener's only way into the database (spec: unmute-setup.md §5).
// POST { id, group_id, text, sent_at } with header x-ingest-secret → upsert into raw_messages.
// Text arrives already prefiltered + redacted on the laptop. Never logs message text.
import { db } from '../_shared/supabase.ts'
import { json, safeEqual } from '../_shared/cors.ts'

const SECRET = Deno.env.get('INGEST_SECRET') ?? ''
const FIELDS = ['id', 'group_id', 'text', 'sent_at']
const MAX_TEXT = 4000   // a long announcement fits; anything bigger is not a campus message

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)

  const given = req.headers.get('x-ingest-secret') ?? ''
  if (!SECRET || !safeEqual(given, SECRET)) return json({ ok: false, error: 'unauthorized' }, 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid JSON' }, 400)
  }

  // Exactly these four fields: anything extra (e.g. a sender) is rejected, not silently dropped.
  const keys = body && typeof body === 'object' ? Object.keys(body) : []
  if (keys.length !== FIELDS.length || !FIELDS.every((f) => keys.includes(f))) {
    return json({ ok: false, error: `body must have exactly: ${FIELDS.join(', ')}` }, 400)
  }
  const { id, group_id, text, sent_at } = body
  if (
    typeof id !== 'string' || !id ||
    typeof group_id !== 'string' || !group_id ||
    typeof text !== 'string' || !text || text.length > MAX_TEXT ||
    typeof sent_at !== 'string' || Number.isNaN(Date.parse(sent_at))
  ) {
    return json({ ok: false, error: 'invalid field values' }, 400)
  }

  // Same WhatsApp id twice (retries, reconnects) → keep the first row, no error.
  const { error } = await db
    .from('raw_messages')
    .upsert({ id, group_id, text, sent_at }, { onConflict: 'id', ignoreDuplicates: true })

  if (error) {
    console.error('ingest failed', id, error.message)
    return json({ ok: false, error: 'db error' }, 500)
  }
  console.log('ingested', id)
  return json({ ok: true })
})
