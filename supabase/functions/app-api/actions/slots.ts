import { db } from '../../_shared/supabase.ts'
import { validateSlots } from '../../_shared/validate-slots.ts'

// Permanent timetable changes happen ONLY here (the agent can only override one date, in user mode).
const UUID = /^[0-9a-f-]{36}$/i

// slots.save_import { mode: 'replace' | 'add', slots[] } → after the review screen.
// replace = swap the user's class slots, keep personal ones (gym, tuition…).
async function saveImport(p: Record<string, unknown>, ctx: { userId: string }) {
  if (p.mode !== 'replace' && p.mode !== 'add') return { ok: false, error: "mode must be 'replace' or 'add'" }
  const { slots, warnings } = validateSlots(p.slots, 'class')
  if (!slots.length) return { ok: false, error: 'no valid rows', warnings }

  // Old class slots are deleted only after the new ones are saved, so a failure never leaves you with none.
  let oldIds: string[] = []
  if (p.mode === 'replace') {
    const { data } = await db.from('timetable_slots').select('id').eq('user_id', ctx.userId).eq('kind', 'class')
    oldIds = (data ?? []).map((r) => r.id)
  }

  const { data, error } = await db
    .from('timetable_slots')
    .insert(slots.map((s) => ({ ...s, user_id: ctx.userId })))
    .select('id')
  if (error) throw error

  if (oldIds.length) {
    const { error: delError } = await db.from('timetable_slots').delete().in('id', oldIds).eq('user_id', ctx.userId)
    if (delError) throw delError
  }
  return { ok: true, saved: data.length, slot_ids: data.map((r) => r.id), warnings }
}

// slots.add { day_of_week, start_time, end_time, label, kind? } (default kind: personal)
async function add(p: Record<string, unknown>, ctx: { userId: string }) {
  const { slots, warnings } = validateSlots([p], 'personal')
  if (!slots.length) return { ok: false, error: warnings[0] ?? 'invalid slot' }
  const { data, error } = await db
    .from('timetable_slots')
    .insert({ ...slots[0], user_id: ctx.userId })
    .select('id')
    .single()
  if (error) throw error
  return { ok: true, slot_id: data.id }
}

// slots.edit { slot_id, ...fields } → merged with the current row, re-validated
async function edit(p: Record<string, unknown>, ctx: { userId: string }) {
  const slotId = String(p.slot_id ?? '')
  if (!UUID.test(slotId)) return { ok: false, error: 'invalid slot_id' }
  const { data: current } = await db
    .from('timetable_slots')
    .select('day_of_week, start_time, end_time, label, kind')
    .eq('id', slotId).eq('user_id', ctx.userId)
    .maybeSingle()
  if (!current) return { ok: false, error: 'slot not found' }

  const { slot_id: _, ...fields } = p
  const { slots, warnings } = validateSlots([{ ...current, ...fields }], current.kind)
  if (!slots.length) return { ok: false, error: warnings[0] ?? 'invalid slot' }

  const { error } = await db.from('timetable_slots').update(slots[0]).eq('id', slotId).eq('user_id', ctx.userId)
  if (error) throw error
  return { ok: true }
}

// slots.delete { slot_id } → its date overrides go with it (on delete cascade)
async function remove(p: Record<string, unknown>, ctx: { userId: string }) {
  const slotId = String(p.slot_id ?? '')
  if (!UUID.test(slotId)) return { ok: false, error: 'invalid slot_id' }
  const { data, error } = await db.from('timetable_slots').delete().eq('id', slotId).eq('user_id', ctx.userId).select('id')
  if (error) throw error
  if (!data.length) return { ok: false, error: 'slot not found' }
  return { ok: true }
}

export const slotActions = {
  'slots.save_import': saveImport, 'slots.add': add, 'slots.edit': edit, 'slots.delete': remove,
}
