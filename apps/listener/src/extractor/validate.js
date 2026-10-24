// Drops invalid ops so a bad model answer can never write bad data. Logs ids/counts only.
import { TAGS, TYPES } from './schema.js'

const DATE_FIELDS = ['deadline_at', 'starts_at', 'ends_at']
const PLACEHOLDER = /\s*\[(phone|email|mention)\]/gi

const isDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v))
const clean = (v, max) => (typeof v === 'string' ? v.replace(PLACEHOLDER, '').trim().slice(0, max) || null : null)
const isLink = (v) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v)
const httpsLink = (v) => (typeof v !== 'string' ? null : isLink(v) ? v : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v) ? `https://${v}` : null)

// Normalise the fields the model may set; null/missing values are dropped (= "no change" for updates).
function cleanFields(f = {}) {
  const out = {}
  if (TYPES.includes(f.type)) out.type = f.type
  if (clean(f.title, 120)) out.title = clean(f.title, 120)
  if (clean(f.summary, 300)) out.summary = clean(f.summary, 300)
  if (Array.isArray(f.tags)) {
    const tags = [...new Set(f.tags.filter((t) => TAGS.includes(t)))].slice(0, 4)
    if (tags.length) out.tags = tags
  }
  for (const k of DATE_FIELDS) if (isDate(f[k])) out[k] = new Date(f[k]).toISOString()
  if (clean(f.location, 120)) out.location = clean(f.location, 120)
  if (httpsLink(f.link)) out.link = httpsLink(f.link)
  return out
}

// result: Gemini's JSON · batchIds: message ids in this batch · cardIds: ids of the existing cards shown
export function validate(result, { batchIds, cardIds }) {
  const inBatch = new Set(batchIds)
  const known = new Set(cardIds)
  let dropped = 0

  const decisions = new Map()
  for (const d of result?.decisions ?? []) {
    if (inBatch.has(d?.message_id)) decisions.set(d.message_id, d.relevant === true)
  }

  const ops = []
  for (const raw of result?.operations ?? []) {
    const sources = (raw?.source_message_ids ?? []).filter((id) => inBatch.has(id))
    const fields = cleanFields(raw?.fields)
    let ok = sources.length > 0

    if (raw?.op === 'create') {
      if (!fields.type || !fields.title) ok = false
      // Announcements may have no time ("No classes on Monday" is still useful); the rest need one.
      if (fields.type !== 'announcement' && !fields.deadline_at && !fields.starts_at) ok = false
      if (!fields.tags) fields.tags = ['other']
    } else if (raw?.op === 'update' || raw?.op === 'cancel') {
      if (!known.has(raw.card_id)) ok = false
      if (raw.op === 'cancel') for (const k of Object.keys(fields)) delete fields[k]
    } else {
      ok = false
    }
    if (fields.starts_at && fields.ends_at && fields.ends_at <= fields.starts_at) delete fields.ends_at

    if (!ok) { dropped++; continue }
    ops.push({ op: raw.op, card_id: raw.op === 'create' ? null : raw.card_id, source_message_ids: sources, fields })
    for (const id of sources) decisions.set(id, true)   // a message an op came from is relevant
  }

  if (dropped) console.log(`extractor: dropped ${dropped} invalid op(s)`)
  return { decisions, ops }
}
