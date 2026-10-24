import { db } from '../../_shared/supabase.ts'
import { defaultEnd } from '../../_shared/default-end.ts'

const UUID = /^[0-9a-f-]{36}$/i
const validTime = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v))

// Overlaps with the user's timetable + plan, returned as a warning (the user may overlap on purpose).
async function clashes(userId: string, startsAt: string, endsAt: string, ignore: string | null = null) {
  const { data, error } = await db.rpc('check_clash', {
    p_user: userId, p_starts: startsAt, p_ends: endsAt, p_ignore: ignore,
  })
  if (error) throw error
  return (data ?? []).map((c: Record<string, unknown>) => ({ source: c.source, id: c.id, title: c.title }))
}

// entry.add { title, starts_at, ends_at?, card_id? } → plan_entries (placed_by: user)
async function add(p: Record<string, unknown>, ctx: { userId: string }) {
  const title = typeof p.title === 'string' ? p.title.trim().slice(0, 120) : ''
  if (!title) return { ok: false, error: 'title required' }
  if (!validTime(p.starts_at)) return { ok: false, error: 'starts_at must be an ISO time' }
  if (p.ends_at != null && !validTime(p.ends_at)) return { ok: false, error: 'ends_at must be an ISO time' }

  let tags: string[] = []
  const cardId = p.card_id ? String(p.card_id) : null
  if (cardId) {
    if (!UUID.test(cardId)) return { ok: false, error: 'invalid card_id' }
    const { data: card } = await db.from('cards').select('tags').eq('id', cardId).maybeSingle()
    if (!card) return { ok: false, error: 'card not found' }
    tags = card.tags
  }

  const startsAt = p.starts_at as string
  const estimated = p.ends_at == null
  const endsAt = estimated ? defaultEnd({ starts_at: startsAt, title, tags }) : (p.ends_at as string)
  if (Date.parse(endsAt) <= Date.parse(startsAt)) return { ok: false, error: 'end must be after start' }

  const { data, error } = await db
    .from('plan_entries')
    .insert({
      user_id: ctx.userId, card_id: cardId, title, starts_at: startsAt, ends_at: endsAt,
      end_estimated: estimated, placed_by: 'user',
    })
    .select('id')
    .single()
  if (error) throw error
  return { ok: true, entry_id: data.id, ends_at: endsAt, end_estimated: estimated, conflicts: await clashes(ctx.userId, startsAt, endsAt, data.id) }
}

// entry.move { entry_id, starts_at, ends_at? } → no end given = keep the same length.
// A moved entry becomes placed_by 'user': the user decided it, so auto agent runs won't touch it.
async function move(p: Record<string, unknown>, ctx: { userId: string }) {
  const entryId = String(p.entry_id ?? '')
  if (!UUID.test(entryId)) return { ok: false, error: 'invalid entry_id' }
  if (!validTime(p.starts_at)) return { ok: false, error: 'starts_at must be an ISO time' }
  if (p.ends_at != null && !validTime(p.ends_at)) return { ok: false, error: 'ends_at must be an ISO time' }

  const { data: entry } = await db
    .from('plan_entries')
    .select('starts_at, ends_at, end_estimated')
    .eq('id', entryId).eq('user_id', ctx.userId).neq('status', 'cancelled')
    .maybeSingle()
  if (!entry) return { ok: false, error: 'entry not found' }

  const startsAt = p.starts_at as string
  const length = Date.parse(entry.ends_at) - Date.parse(entry.starts_at)
  const endsAt = p.ends_at != null ? (p.ends_at as string) : new Date(Date.parse(startsAt) + length).toISOString()
  if (Date.parse(endsAt) <= Date.parse(startsAt)) return { ok: false, error: 'end must be after start' }

  const { error } = await db
    .from('plan_entries')
    .update({
      starts_at: startsAt, ends_at: endsAt, placed_by: 'user',
      end_estimated: p.ends_at != null ? false : entry.end_estimated,
    })
    .eq('id', entryId).eq('user_id', ctx.userId)
  if (error) throw error
  return { ok: true, ends_at: endsAt, conflicts: await clashes(ctx.userId, startsAt, endsAt, entryId) }
}

// entry.delete { entry_id } → status cancelled (kept for the agent's history, hidden from the week)
async function remove(p: Record<string, unknown>, ctx: { userId: string }) {
  const entryId = String(p.entry_id ?? '')
  if (!UUID.test(entryId)) return { ok: false, error: 'invalid entry_id' }
  const { data, error } = await db
    .from('plan_entries')
    .update({ status: 'cancelled' })
    .eq('id', entryId).eq('user_id', ctx.userId)
    .select('id')
  if (error) throw error
  if (!data.length) return { ok: false, error: 'entry not found' }
  return { ok: true }
}

// week.add { card_id } → the UI's "Add to my week": card_actions 'added' + one user entry for the card.
// Event / timed announcement → at the card's time. Deadline / opportunity → a 30-min "Register for X"
// ending at the deadline. Clashes come back as a warning (like entry.add). Adding twice is a no-op.
async function weekAdd(p: Record<string, unknown>, ctx: { userId: string }) {
  const cardId = String(p.card_id ?? '')
  if (!UUID.test(cardId)) return { ok: false, error: 'invalid card_id' }
  const { data: card } = await db.from('cards')
    .select('id, type, title, tags, starts_at, ends_at, deadline_at, status').eq('id', cardId).maybeSingle()
  if (!card) return { ok: false, error: 'card not found' }
  if (card.status === 'cancelled') return { ok: false, error: 'this was cancelled' }

  const { data: existing } = await db.from('plan_entries').select('id')
    .eq('user_id', ctx.userId).eq('card_id', cardId).eq('status', 'planned').limit(1)
  if (existing?.length) return { ok: true, entry_id: existing[0].id, conflicts: [] }

  let title = card.title, startsAt: string, endsAt: string, estimated = false
  if (card.starts_at) {
    startsAt = card.starts_at
    estimated = !card.ends_at
    endsAt = card.ends_at ?? defaultEnd({ starts_at: startsAt, title, tags: card.tags })
  } else if (card.deadline_at) {
    title = `Register for ${card.title}`
    endsAt = card.deadline_at
    startsAt = new Date(Date.parse(endsAt) - 30 * 60_000).toISOString()
  } else {
    return { ok: false, error: 'this has no date to put in your week' }
  }
  if (Date.parse(endsAt) <= Date.now()) return { ok: false, error: 'this has already passed' }

  await db.from('card_actions').upsert(
    { user_id: ctx.userId, card_id: cardId, action: 'added', created_at: new Date().toISOString() },
    { onConflict: 'user_id,card_id' },
  )
  const { data, error } = await db.from('plan_entries').insert({
    user_id: ctx.userId, card_id: cardId, title, starts_at: startsAt, ends_at: endsAt,
    end_estimated: estimated, placed_by: 'user',
  }).select('id').single()
  if (error) throw error
  return { ok: true, entry_id: data.id, conflicts: await clashes(ctx.userId, startsAt, endsAt, data.id) }
}

// week.remove { card_id } → cancel this user's planned entries for the card (agent's too) + forget 'added'.
async function weekRemove(p: Record<string, unknown>, ctx: { userId: string }) {
  const cardId = String(p.card_id ?? '')
  if (!UUID.test(cardId)) return { ok: false, error: 'invalid card_id' }
  const { data, error } = await db.from('plan_entries').update({ status: 'cancelled' })
    .eq('user_id', ctx.userId).eq('card_id', cardId).eq('status', 'planned').select('id')
  if (error) throw error
  await db.from('card_actions').delete().eq('user_id', ctx.userId).eq('card_id', cardId).eq('action', 'added')
  return { ok: true, removed: data.length }
}

export const entryActions = {
  'entry.add': add, 'entry.move': move, 'entry.delete': remove, 'week.add': weekAdd, 'week.remove': weekRemove,
}
