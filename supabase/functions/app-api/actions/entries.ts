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

export const entryActions = { 'entry.add': add, 'entry.move': move, 'entry.delete': remove }
