// Fan-out: start AI #2 only for the users a card matters to (docs/3-build/unmute-ai-plan.md → Fan-out).
// Does nothing while AGENT_URL is empty (until the planner agent is deployed).

const EVERYONE_TAGS = ['placement', 'academic']

export async function fanOut({ supabase, config, created, changed }) {
  if (!config.agentUrl || (!created.length && !changed.length)) return
  const perUser = new Map()   // user id → { changes: [], card_ids: [] }
  const forUser = (id) => perUser.get(id) ?? perUser.set(id, { changes: [], card_ids: [] }).get(id)

  // Changed / cancelled cards → users with a planned entry linked to them.
  if (changed.length) {
    const { data, error } = await supabase
      .from('plan_entries')
      .select('user_id, card_id')
      .in('card_id', changed.map((c) => c.card_id))
      .eq('status', 'planned')
    if (error) throw error
    for (const row of data) {
      const u = forUser(row.user_id)
      const change = changed.find((c) => c.card_id === row.card_id)
      if (!u.changes.includes(change)) u.changes.push(change)
    }
  }

  // New cards → users whose interests overlap the tags (placement/academic → everyone with a profile).
  for (const card of created) {
    let query = supabase.from('profiles').select('id')
    if (!card.tags.some((t) => EVERYONE_TAGS.includes(t))) query = query.overlaps('interests', card.tags)
    const { data, error } = await query
    if (error) throw error
    for (const p of data) forUser(p.id).card_ids.push(card.id)
  }

  // card_changed before new_card for the same user. The agent replies at once, so this loop is quick.
  for (const [userId, { changes, card_ids }] of perUser) {
    if (changes.length) await post(config, { trigger: 'card_changed', user_id: userId, payload: { changes } })
    if (card_ids.length) await post(config, { trigger: 'new_card', user_id: userId, payload: { card_ids } })
  }
  console.log(`fan-out: ${perUser.size} user(s)`)
}

async function post(config, body) {
  try {
    const res = await fetch(config.agentUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-agent-secret': config.agentSecret },
      body: JSON.stringify(body),
    })
    if (!res.ok) console.error('agent rejected', body.trigger, res.status)
  } catch (err) {
    console.error('agent unreachable', body.trigger, err.message)
  }
}
