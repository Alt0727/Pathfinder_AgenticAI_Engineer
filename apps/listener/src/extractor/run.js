// AI #1 loop: 10 s after the last ingested message (debounce) + every 60 s (safety net).
// One batch (≤ 20 oldest raw messages) at a time. On a Gemini error nothing changes; the next tick retries.
import { generateJSON } from '../lib/gemini.js'
import { apply } from './apply.js'
import { buildPrompt, SYSTEM } from './prompt.js'
import { schema } from './schema.js'
import { fanOut } from './triggers.js'
import { validate } from './validate.js'

const BATCH = 20
const DEBOUNCE_MS = 10_000
const INTERVAL_MS = 60_000

// Pure step, shared with eval/run.js: messages + known cards → validated decisions + ops. No DB.
export async function extractBatch({ messages, cards, now }) {
  const result = await generateJSON({ system: SYSTEM, prompt: buildPrompt({ messages, cards, now }), schema })
  return validate(result, { batchIds: messages.map((m) => m.id), cardIds: cards.map((c) => c.id) })
}

export function createExtractor({ supabase, config }) {
  let timer = null
  let running = false
  let again = false

  async function loadBatch() {
    const { data: messages, error } = await supabase
      .from('raw_messages').select('id, group_id, text, sent_at').order('sent_at').limit(BATCH)
    if (error) throw error
    if (!messages.length) return { messages }

    // group_name comes from the invite row the group was joined through
    const groupIds = [...new Set(messages.map((m) => m.group_id))]
    const { data: groups } = await supabase.from('group_invites').select('group_id, group_name').in('group_id', groupIds).eq('status', 'joined')
    const names = new Map((groups ?? []).map((g) => [g.group_id, g.group_name]))
    for (const m of messages) m.group_name = names.get(m.group_id) ?? null

    const since = new Date(Date.now() - 30 * 86400_000).toISOString()
    const { data: cards, error: cardsError } = await supabase
      .from('cards').select('id, type, title, deadline_at, starts_at, source_group_id')
      .eq('status', 'active').gte('created_at', since).order('created_at')
    if (cardsError) throw cardsError
    return { messages, cards }
  }

  // → true if the batch was full (more rows may be waiting)
  async function runBatch() {
    const { messages, cards } = await loadBatch()
    if (!messages.length) return false

    const { decisions, ops } = await extractBatch({ messages, cards, now: new Date() })
    const { created, changed } = await apply({ supabase, ops, messages })

    const relevant = [...decisions.values()].filter(Boolean).length
    console.log(`extractor: ${messages.length} message(s), ${relevant} relevant → ${created.length} created, ${changed.length} changed; raw rows deleted`)

    await fanOut({ supabase, config, created, changed })
    return messages.length === BATCH
  }

  async function tick() {
    if (running) { again = true; return }   // one batch at a time
    running = true
    try {
      while (await runBatch()) { /* keep going while batches are full */ }
    } catch (err) {
      console.error('extractor error (rows kept, will retry):', err.message)
    } finally {
      running = false
      if (again) { again = false; notify() }
    }
  }

  // Called after each successful ingest.
  function notify() {
    clearTimeout(timer)
    timer = setTimeout(tick, DEBOUNCE_MS)
  }

  function start() {
    setInterval(tick, INTERVAL_MS)
    tick()   // process anything left over from before a restart
  }

  return { notify, start }
}
