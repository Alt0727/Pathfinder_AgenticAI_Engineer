// message → text → PREFILTER → REDACT → POST /ingest.
// Only { id, group_id, text, sent_at } leave the laptop: never the sender, name or number.
// Logs ids only, never message text. A failed POST never crashes the listener.
import { normalizeMessageContent } from 'baileys'
import { prefilter } from '../privacy/prefilter.js'
import { redact } from '../privacy/redact.js'

// Text of a message, or '' for media without a caption, stickers, reactions, etc.
function textOf(msg) {
  const m = normalizeMessageContent(msg.message)
  return (
    m?.conversation ||
    m?.extendedTextMessage?.text ||
    m?.imageMessage?.caption ||
    m?.videoMessage?.caption ||
    m?.documentMessage?.caption ||
    ''
  )
}

// messageTimestamp is seconds, sometimes a protobuf Long.
function sentAt(msg) {
  const ts = msg.messageTimestamp
  const seconds = typeof ts === 'object' && ts !== null ? ts.toNumber() : Number(ts)
  return new Date(seconds ? seconds * 1000 : Date.now()).toISOString()
}

// onIngested: called after each saved message (wakes up AI #1).
export function createIngest({ config, watchedGroups, onIngested = () => {} }) {
  async function post(row) {
    try {
      const res = await fetch(config.ingestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ingest-secret': config.ingestSecret },
        body: JSON.stringify(row),
      })
      if (res.ok) {
        console.log('ingested', row.id)
        onIngested()
      } else console.error('ingest rejected', row.id, res.status)
    } catch (err) {
      console.error('ingest unreachable', row.id, err.message)
    }
  }

  return async function handleMessages(messages) {
    for (const msg of messages) {
      const groupId = msg.key?.remoteJid
      if (!groupId?.endsWith('@g.us') || !watchedGroups.has(groupId)) continue   // watched groups only

      const text = textOf(msg)
      if (!text) continue

      const { keep, reason } = prefilter(text)
      if (!keep) {
        console.log('dropped', msg.key.id, `(${reason})`)
        continue
      }

      await post({ id: msg.key.id, group_id: groupId, text: redact(text), sent_at: sentAt(msg) })
    }
  }
}
