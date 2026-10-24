// override_slot: change ONE date of a timetable class. Only offered in user mode (chat / answer),
// and the handler checks the mode again, so an auto run can never touch the timetable.
import { db } from '../../_shared/supabase.ts'
import { dayOfWeek, toIST } from '../../_shared/time.ts'
import { cardInfo, clashes, freeTimes } from './read.ts'
import { defaultEnd } from '../../_shared/default-end.ts'
import { isDate, isTime, isUuid, MAX_WRITES, text, type Tool } from './index.ts'

export const userOnlyTools: Tool[] = [
  {
    declaration: {
      name: 'override_slot',
      description: 'For ONE date only: cancel a timetable class, or move it to another time. Only when the user asked for it. Permanent timetable changes are made by the user on the timetable screen.',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          slot_id: { type: 'string', description: 'the timetable item id from get_week' },
          date: { type: 'string', description: 'YYYY-MM-DD: the date the class normally happens' },
          action: { type: 'string', enum: ['cancel', 'move'] },
          starts_at: { type: 'string', description: 'move only: new start, ISO with +05:30' },
          ends_at: { type: 'string', description: 'move only: new end, ISO with +05:30' },
          for_card_id: { type: 'string', description: 'move only: the card whose event you are making room for; the class may not land on that event' },
          reason: { type: 'string' },
        },
        required: ['slot_id', 'date', 'action', 'reason'],
      },
    },
    handler: async (args, ctx) => {
      if (ctx.mode !== 'user') return { ok: false, error: 'override_slot is only allowed when the user asked (user mode)' }
      if (ctx.writes >= MAX_WRITES) return { ok: false, error: `write limit reached (${MAX_WRITES} per run)` }
      const reason = text(args.reason)
      if (!reason) return { ok: false, error: 'reason is required' }
      if (!isUuid(args.slot_id)) return { ok: false, error: 'invalid slot_id' }
      if (!isDate(args.date)) return { ok: false, error: 'date must be YYYY-MM-DD' }
      if (args.action !== 'cancel' && args.action !== 'move') return { ok: false, error: "action must be 'cancel' or 'move'" }

      const { data: slot } = await db.from('timetable_slots').select('id, day_of_week, label')
        .eq('id', args.slot_id).eq('user_id', ctx.userId).maybeSingle()
      if (!slot) return { ok: false, error: 'slot not found' }
      if (slot.day_of_week !== dayOfWeek(args.date)) return { ok: false, error: `${slot.label} does not happen on ${args.date}` }

      const row: Record<string, unknown> = {
        user_id: ctx.userId, slot_id: slot.id, date: args.date, action: args.action, reason, starts_at: null, ends_at: null,
      }
      if (args.action === 'move') {
        if (!isTime(args.starts_at) || !isTime(args.ends_at)) return { ok: false, error: 'move needs starts_at and ends_at' }
        if (Date.parse(args.ends_at) <= Date.parse(args.starts_at)) return { ok: false, error: 'end must be after start' }
        if (Date.parse(args.starts_at) <= Date.now()) return { ok: false, error: 'starts_at is in the past' }
        // The event this move makes room for counts as busy too (it is added AFTER the move).
        const card = args.for_card_id ? await cardInfo(args.for_card_id) : null
        const event: [number, number][] = card?.starts_at
          ? [[Date.parse(card.starts_at), Date.parse(card.ends_at ?? defaultEnd({ starts_at: card.starts_at, tags: card.tags }))]]
          : []
        const onEvent = event.some(([s, e]) => s < Date.parse(args.ends_at as string) && Date.parse(args.starts_at as string) < e)
        const conflicts = await clashes(ctx.userId, args.starts_at, args.ends_at, slot.id)
        if (conflicts.length || onEvent) {
          const minutes = Math.round((Date.parse(args.ends_at) - Date.parse(args.starts_at)) / 60_000)
          const free = await freeTimes(ctx.userId, toIST(args.starts_at)!.slice(0, 10), minutes, event)
          return { ok: false, error: onEvent ? 'the class would land on the event you are making room for: pick one of free_times_same_day' : 'the new time clashes: pick one of free_times_same_day', conflicts, free_times_same_day: free }
        }
        row.starts_at = args.starts_at
        row.ends_at = args.ends_at
      }

      const { error } = await db.from('timetable_overrides').upsert(row, { onConflict: 'slot_id,date' })
      if (error) throw error
      ctx.writes++
      return { ok: true, slot: slot.label, date: args.date, action: args.action, starts_at: toIST(row.starts_at as string | null) }
    },
  },
]
