import { supabase } from '@/lib/supabase'
import { must, useLive } from '@/hooks/useLive'

// Upcoming deadlines, soonest first. The live countdown + "< 24 h" highlight are done in the UI.
export function useRadar(userId) {
  const { data, ...rest } = useLive('radar', ['cards'], () =>
    must(
      supabase
        .from('cards')
        .select('id, title, type, tags, deadline_at, link, source_group_name')
        .eq('status', 'active')
        .gt('deadline_at', new Date().toISOString())
        .order('deadline_at'),
    ),
  !!userId)
  return { deadlines: data ?? [], ...rest }
}
