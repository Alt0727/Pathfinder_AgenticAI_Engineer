import { supabase } from '@/lib/supabase'
import { weekRange } from '@/lib/time'
import { must, useLive } from '@/hooks/useLive'

// Timetable view: this week's real class times (overrides applied) + the editable weekly slot list.
export function useTimetable(userId) {
  const { from, to } = weekRange()
  const { data, ...rest } = useLive('timetable', ['timetable_slots', 'timetable_overrides'], async () => {
    const [rows, slots] = await Promise.all([
      must(supabase.rpc('get_week', { p_user: userId, p_from: from, p_to: to })),
      must(supabase.from('timetable_slots').select('*').eq('user_id', userId).order('day_of_week').order('start_time')),
    ])
    return { week: rows.filter((r) => r.source === 'timetable'), slots }
  }, !!userId)

  return { from, to, week: data?.week ?? [], slots: data?.slots ?? [], ...rest }
}
