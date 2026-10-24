// npm run eval: AI #1 accuracy on the 50 labelled messages (dry run: no database writes).
// prefilter → redact → extractor in batches of 20, with an in-memory card list so update/cancel
// ops can target cards created earlier in the run. Scoring rules: labelled.json → scoring.
import { readFileSync } from 'fs'
import { config } from '../src/config.js'
import { extractBatch } from '../src/extractor/run.js'
import { prefilter } from '../src/privacy/prefilter.js'
import { redact } from '../src/privacy/redact.js'

const { messages } = JSON.parse(readFileSync(new URL('./labelled.json', import.meta.url), 'utf8'))
const sorted = [...messages].sort((a, b) => Date.parse(a.sent_at) - Date.parse(b.sent_at))
const sameTime = (a, b) => (a == null || b == null ? a == null && b == null : Date.parse(a) === Date.parse(b))
const pct = (n, d) => `${n}/${d} (${d ? Math.round((100 * n) / d) : 0}%)`

// 1. Privacy filter, exactly like the listener
const aiRelevant = new Map()
const kept = []
for (const m of sorted) {
  if (!prefilter(m.text).keep) { aiRelevant.set(m.id, false); continue }
  kept.push({ id: m.id, group_id: m.group_name, group_name: m.group_name, text: redact(m.text), sent_at: m.sent_at })
}

// 2. Extractor in batches, applying ops to an in-memory card list
const cards = []
const opsLog = []
let n = 0
for (let i = 0; i < kept.length; i += 20) {
  const batch = kept.slice(i, i + 20)
  const active = cards.filter((c) => c.status === 'active')
  let result
  try {
    result = await extractBatch({ messages: batch, cards: active, now: batch.at(-1).sent_at })
  } catch (err) {
    console.log(`batch ${i / 20 + 1} failed once (${err.message}), retrying`)
    result = await extractBatch({ messages: batch, cards: active, now: batch.at(-1).sent_at })
  }
  for (const m of batch) aiRelevant.set(m.id, result.decisions.get(m.id) ?? false)

  for (const op of result.ops) {
    if (op.op === 'create') {
      const card = { id: `card-${String(++n).padStart(2, '0')}`, status: 'active', ...op.fields, sources: op.source_message_ids, source_group_id: batch.find((m) => m.id === op.source_message_ids[0])?.group_id }
      cards.push(card)
      opsLog.push({ ...op, card_id: card.id })
    } else {
      const card = cards.find((c) => c.id === op.card_id)
      if (op.op === 'cancel') card.status = 'cancelled'
      else Object.assign(card, op.fields)
      opsLog.push(op)
    }
  }
}

// 3. Score
const fails = []
const relevanceOk = sorted.filter((m) => {
  const ok = (aiRelevant.get(m.id) ?? false) === m.expected.relevant
  if (!ok) fails.push(`${m.id} relevance: expected ${m.expected.relevant}`)
  return ok
}).length

const refs = new Map()
let creates = 0, typeOk = 0, datesOk = 0, changes = 0, changesOk = 0
for (const m of sorted) {
  for (const exp of m.expected.ops ?? []) {
    if (exp.op === 'create') {
      creates++
      const card = opsLog.find((o) => o.op === 'create' && o.source_message_ids.includes(m.id) && o.fields.type === exp.type && ![...refs.values()].includes(o.card_id))
      if (!card) { fails.push(`${m.id} create ${exp.ref}: no ${exp.type} card`); continue }
      typeOk++
      refs.set(exp.ref, card.card_id)
      const wrong = ['deadline_at', 'starts_at', 'ends_at'].filter((k) => !sameTime(card.fields[k] ?? null, exp[k]))
      if (wrong.length) fails.push(`${m.id} ${exp.ref} dates wrong: ${wrong.map((k) => `${k} got ${card.fields[k] ?? null}, want ${exp[k]}`).join('; ')}`)
      else datesOk++
    } else {
      changes++
      const target = refs.get(exp.ref)
      const op = opsLog.find((o) => o.op === exp.op && o.card_id === target && o.source_message_ids.includes(m.id))
      const fieldsOk = op && Object.entries(exp.fields ?? {}).every(([k, v]) => sameTime(op.fields[k] ?? null, v))
      // A plain reminder in the same batch as its card can't "update" a card that doesn't exist yet:
      // merged into that card's create op (listed as a source) counts as linked.
      const mergedReminder = exp.op === 'update' && !Object.keys(exp.fields ?? {}).length &&
        opsLog.some((o) => o.op === 'create' && o.card_id === target && o.source_message_ids.includes(m.id))
      if ((op && fieldsOk) || mergedReminder) changesOk++
      else fails.push(`${m.id} ${exp.op} ${exp.ref}: ${op ? 'fields wrong' : 'missing or wrong card'}`)
    }
  }
}

const relevantDropped = sorted.filter((m) => m.expected.relevant && !prefilter(m.text).keep).length
const chatter = sorted.filter((m) => !m.expected.relevant)
const chatterDropped = chatter.filter((m) => !prefilter(m.text).keep).length

console.log(`\nAI #1 eval: ${messages.length} labelled messages, model ${config.geminiModel}`)
console.log(`prefilter      ${relevantDropped} relevant dropped (must be 0) · ${chatterDropped}/${chatter.length} chatter removed on the laptop`)
console.log(`relevance      ${pct(relevanceOk, messages.length)}`)
console.log(`type           ${pct(typeOk, creates)}`)
console.log(`dates          ${pct(datesOk, creates)}`)
console.log(`update/cancel  ${pct(changesOk, changes)}`)
if (fails.length) console.log(`\nMisses:\n- ${fails.join('\n- ')}`)
