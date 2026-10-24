import { supabase } from '@/lib/supabase'
import { weekRange } from '@/lib/ist'
import { must, useLive } from '@/hooks/useLive'

const overlaps = (a, b) => Date.parse(a.starts_at) < Date.parse(b.ends_at) && Date.parse(b.starts_at) < Date.parse(a.ends_at)

// Pairs of a plan entry clashing with a timetable slot, and with another plan entry (shown separately).
function findConflicts(plan, timetable) {
  const withTimetable = []
  const withPlan = []
  plan.forEach((entry, i) => {
    for (const slot of timetable) if (overlaps(entry, slot)) withTimetable.push({ entry, other: slot })
    for (const other of plan.slice(i + 1)) if (overlaps(entry, other)) withPlan.push({ entry, other })
  })
  return { timetable: withTimetable, plan: withPlan }
}

// The rolling week (today → today + 6): plan entries for the week view + conflicts for the panel.
// Each row: id, title, starts_at, ends_at, source, placed_by, slot_id, card_id, end_estimated, card_status.
export function useWeek(userId) {
  const { from, to } = weekRange()
  const { data, ...rest } = useLive('week', ['plan_entries', 'timetable_slots', 'timetable_overrides', 'cards'], async () => {
    const rows = await must(supabase.rpc('get_week', { p_user: userId, p_from: from, p_to: to }))
    const timetable = rows.filter((r) => r.source === 'timetable')
    // get_week has no `reason`: fetch it for the plan rows (the agent's "why", shown on the item card)
    const planRows = rows.filter((r) => r.source === 'plan')
    const reasons = planRows.length
      ? await must(supabase.from('plan_entries').select('id, reason').in('id', planRows.map((r) => r.id)))
      : []
    const reasonOf = new Map(reasons.map((r) => [r.id, r.reason]))
    const plan = planRows.map((r) => ({ ...r, reason: reasonOf.get(r.id) ?? null }))
    return { plan, timetable, conflicts: findConflicts(plan, timetable) }
  }, !!userId)

  return {
    from, to,
    entries: data?.plan ?? [],
    conflicts: data?.conflicts ?? { timetable: [], plan: [] },
    ...rest,
  }
}
