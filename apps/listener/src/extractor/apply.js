// Writes validated ops to `cards`, then DELETES the processed raw messages (raw text lives only seconds).
// Returns what changed, for the fan-out to AI #2.

const CHANGEABLE = ['type', 'title', 'summary', 'tags', 'deadline_at', 'starts_at', 'ends_at', 'location', 'link']
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null) ||
  (typeof a === 'string' && typeof b === 'string' && Date.parse(a) === Date.parse(b))

export async function apply({ supabase, ops, messages }) {
  const byId = new Map(messages.map((m) => [m.id, m]))
  const created = []   // { id, tags }
  const changed = []   // { card_id, kind: 'updated' | 'cancelled', old, new }

  for (const op of ops) {
    if (op.op === 'create') {
      const first = byId.get(op.source_message_ids[0])
      const { data, error } = await supabase
        .from('cards')
        .insert({
          ...op.fields,
          source_group_id: first.group_id,
          source_group_name: first.group_name ?? null,
          source_message_ids: op.source_message_ids,
        })
        .select('id, tags')
        .single()
      if (error) throw error
      created.push(data)
      continue
    }

    // update / cancel: read the old values first (the agent is told old → new)
    const { data: card, error } = await supabase.from('cards').select('*').eq('id', op.card_id).single()
    if (error) throw error
    const sources = [...new Set([...card.source_message_ids, ...op.source_message_ids])]

    if (op.op === 'cancel') {
      if (card.status !== 'cancelled') changed.push({ card_id: card.id, kind: 'cancelled', old: { status: card.status }, new: { status: 'cancelled' } })
      await must(supabase.from('cards').update({ status: 'cancelled', source_message_ids: sources, updated_at: new Date().toISOString() }).eq('id', card.id))
      continue
    }

    const diff = { old: {}, new: {} }
    for (const k of CHANGEABLE) {
      if (k in op.fields && !same(op.fields[k], card[k])) { diff.old[k] = card[k]; diff.new[k] = op.fields[k] }
    }
    // A plain reminder changes no fields: it only links the message as a source.
    await must(supabase.from('cards').update({ ...diff.new, source_message_ids: sources, updated_at: new Date().toISOString() }).eq('id', card.id))
    if (Object.keys(diff.new).length) changed.push({ card_id: card.id, kind: 'updated', ...diff })
  }

  // Every message in the batch is deleted, relevant or not.
  await must(supabase.from('raw_messages').delete().in('id', messages.map((m) => m.id)))
  return { created, changed }
}

async function must(query) {
  const { error } = await query
  if (error) throw error
}
