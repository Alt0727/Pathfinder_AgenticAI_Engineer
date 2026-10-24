// Read tools: get_week, get_preferences, check_clash. No writes.
import { db } from '../../_shared/supabase.ts'
import { defaultEnd } from '../../_shared/default-end.ts'
import { toIST, weekRange } from '../../_shared/time.ts'
import { type Ctx, isDate, isTime, isUuid, text, type Tool } from './index.ts'

// get_week RPC rows, compact and in IST.
export async function weekItems(userId: string, from: string, to: string) {
  const { data, error } = await db.rpc('get_week', { p_user: userId, p_from: from, p_to: to })
  if (error) throw error
  return (data ?? []).map((r: Record<string, string | null>) => ({
    id: r.id, title: r.title, starts_at: toIST(r.starts_at), ends_at: toIST(r.ends_at),
    source: r.source, placed_by: r.placed_by, card_id: r.card_id, card_status: r.card_status,
    end_estimated: r.end_estimated,
  }))
}

// Interests, saved preferences and tag affinity (same 90-day / 30-day half-life math as the feed).
export async function preferences(userId: string) {
  const [profile, prefs, actions] = await Promise.all([
    db.from('profiles').select('interests').eq('id', userId).maybeSingle(),
    db.from('user_preferences').select('key, value').eq('user_id', userId),
    db.from('card_actions').select('action, created_at, cards(tags)').eq('user_id', userId)
      .in('action', ['added', 'skipped']).gte('created_at', new Date(Date.now() - 90 * 86400_000).toISOString()),
  ])
  const affinity: Record<string, number> = {}
  for (const a of (actions.data ?? []) as unknown as { action: string; created_at: string; cards: { tags: string[] } | null }[]) {
    const w = 0.5 ** ((Date.now() - Date.parse(a.created_at)) / 86400_000 / 30)
    for (const tag of a.cards?.tags ?? []) affinity[tag] = (affinity[tag] ?? 0) + (a.action === 'added' ? w : -0.5 * w)
  }
  for (const k of Object.keys(affinity)) affinity[k] = Math.round(affinity[k] * 100) / 100
  return {
    interests: profile.data?.interests ?? [],
    saved: Object.fromEntries((prefs.data ?? []).map((p) => [p.key, p.value])),
    tag_affinity: affinity,
  }
}

// Clashes for a time range (ignoring one id, e.g. the entry being moved), compact and in IST.
export async function clashes(userId: string, startsAt: string, endsAt: string, ignore: string | null = null) {
  const { data, error } = await db.rpc('check_clash', { p_user: userId, p_starts: startsAt, p_ends: endsAt, p_ignore: ignore })
  if (error) throw error
  return (data ?? []).map((c: Record<string, string | null>) => ({
    source: c.source, id: c.id, title: c.title, placed_by: c.placed_by, starts_at: toIST(c.starts_at), ends_at: toIST(c.ends_at),
  }))
}

// Free start times on one IST date for something `minutes` long, computed from the real week (not guessed
// by the model): the first fitting start in each gap, between 08:00 and 21:00, respecting the user's
// avoid_before / avoid_after and never in the past. Up to 4. Returned with every clash.
export async function freeTimes(userId: string, date: string, minutes: number) {
  const [items, prefs] = await Promise.all([
    weekItems(userId, date, date),
    db.from('user_preferences').select('key, value').eq('user_id', userId).in('key', ['avoid_after', 'avoid_before']),
  ])
  const pref = Object.fromEntries((prefs.data ?? []).map((p) => [p.key, p.value]))
  const at = (hhmm: string) => Date.parse(`${date}T${hhmm}:00+05:30`)
  const valid = (v: unknown) => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
  const len = minutes * 60_000, step = 15 * 60_000
  const dayEnd = valid(pref.avoid_after) ? Math.min(at('21:00'), at(pref.avoid_after)) : at('21:00')
  let t = Math.max(valid(pref.avoid_before) ? at(pref.avoid_before) : at('08:00'), at('08:00'))
  if (t < Date.now()) t = Math.ceil(Date.now() / step) * step
  const busy = items.map((i: { starts_at: string | null; ends_at: string | null }) => [Date.parse(i.starts_at!), Date.parse(i.ends_at!)])

  const out: string[] = []
  while (t + len <= dayEnd && out.length < 4) {
    const hit = busy.filter(([s, e]: number[]) => s < t + len && t < e)
    if (!hit.length) {
      out.push(toIST(new Date(t).toISOString())!)
      const next = busy.map(([s]: number[]) => s).filter((s: number) => s >= t + len).sort((a: number, b: number) => a - b)[0]
      if (!next) break
      t = next   // jump to the next busy block: one suggestion per free gap
    } else {
      t = Math.max(...hit.map(([, e]: number[]) => e))   // skip past what's in the way
    }
  }
  return out
}

type CardInfo ={ title: string; tags: string[]; starts_at: string | null; ends_at: string | null }

// The card an entry is for (tags for default lengths, times for the end-time rule), or null.
export async function cardInfo(cardId: unknown): Promise<CardInfo | null> {
  if (!isUuid(cardId)) return null
  const { data } = await db.from('cards').select('title, tags, starts_at, ends_at').eq('id', cardId).maybeSingle()
  return data
}

// The card's own event at this start time? Then its end comes from the card (or the default, estimated):
// the model may never invent an event's end time.
export function eventEnd(card: CardInfo | null, startsAt: string, title: string) {
  if (card?.starts_at && Date.parse(card.starts_at) === Date.parse(startsAt)) {
    return card.ends_at
      ? { endsAt: card.ends_at, estimated: false }
      : { endsAt: defaultEnd({ starts_at: startsAt, title, tags: card.tags }), estimated: true }
  }
  return null
}

// In auto mode, remember any card EVENT whose time clashes with something the agent may not touch
// (a timetable class or a user-placed entry). finish is refused until the agent asks about it.
export async function noteFixedClash(ctx: Ctx, startsAt: string, conflicts: { source: unknown; placed_by: unknown; title: unknown }[]) {
  if (ctx.mode !== 'auto') return
  const fixed = conflicts.filter((c) => c.source === 'timetable' || c.placed_by === 'user').map((c) => String(c.title))
  if (!fixed.length) return
  const { data } = await db.from('cards').select('title').eq('status', 'active').eq('starts_at', new Date(startsAt).toISOString())
  for (const card of data ?? []) {
    if (!ctx.fixedClashes.some((f) => f.event === card.title)) ctx.fixedClashes.push({ event: card.title, with: fixed })
  }
}

export const readTools: Tool[] = [
  {
    declaration: {
      name: 'get_week',
      description: 'Your plan entries and timetable classes for a date range (default today → today+6). Use after writes if you need fresh data.',
      parametersJsonSchema: {
        type: 'object',
        properties: { from: { type: 'string', description: 'YYYY-MM-DD' }, to: { type: 'string', description: 'YYYY-MM-DD' } },
      },
    },
    handler: async (args, ctx: Ctx) => {
      const week = weekRange()
      const from = isDate(args.from) ? args.from : week.from
      const to = isDate(args.to) ? args.to : week.to
      if (to < from || Date.parse(to) - Date.parse(from) > 13 * 86400_000) return { ok: false, error: 'range must be 1–14 days' }
      return { ok: true, from, to, items: await weekItems(ctx.userId, from, to) }
    },
  },
  {
    declaration: {
      name: 'get_preferences',
      description: 'The user interests, saved preferences (e.g. avoid_after) and tag affinity from past added/skipped cards.',
      parametersJsonSchema: { type: 'object', properties: {} },
    },
    handler: async (_args, ctx) => ({ ok: true, ...(await preferences(ctx.userId)) }),
  },
  {
    declaration: {
      name: 'check_clash',
      description: 'Is this time free? Returns timetable classes and plan entries that overlap. Leave ends_at out if unknown (a default length is used).',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          starts_at: { type: 'string', description: 'ISO time with +05:30' },
          ends_at: { type: 'string', description: 'ISO time with +05:30 (optional)' },
          card_id: { type: 'string', description: 'the card this is for (optional; sets the default length)' },
          title: { type: 'string', description: 'the entry you plan to add (optional; "Register for X" tasks are 30 min)' },
        },
        required: ['starts_at'],
      },
    },
    handler: async (args, ctx) => {
      if (!isTime(args.starts_at)) return { ok: false, error: 'starts_at must be an ISO time' }
      if (args.ends_at != null && !isTime(args.ends_at)) return { ok: false, error: 'ends_at must be an ISO time' }
      const card = await cardInfo(args.card_id)
      // Same default length add_entry will use, so a free answer here means add_entry will succeed.
      const endsAt = eventEnd(card, args.starts_at, card?.title ?? '')?.endsAt ??
        (args.ends_at as string) ?? defaultEnd({ starts_at: args.starts_at, title: text(args.title), tags: card?.tags ?? [] })
      const conflicts = await clashes(ctx.userId, args.starts_at, endsAt)
      await noteFixedClash(ctx, args.starts_at, conflicts)
      if (!conflicts.length) return { ok: true, clear: true, ends_at: toIST(endsAt), conflicts }
      // Not free: give real free times that day for the same length (only useful for flexible items).
      const minutes = Math.round((Date.parse(endsAt) - Date.parse(args.starts_at)) / 60_000)
      const free_times = await freeTimes(ctx.userId, toIST(args.starts_at)!.slice(0, 10), minutes)
      return { ok: true, clear: false, ends_at: toIST(endsAt), conflicts, free_times_same_day: free_times }
    },
  },
]
