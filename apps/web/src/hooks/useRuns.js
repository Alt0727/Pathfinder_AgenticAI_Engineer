import { supabase } from '@/lib/supabase'
import { must, useLive } from '@/hooks/useLive'

// Live run panel: the latest 5 agent runs. `steps` grows while a run is going (each tool call + result).
export function useRuns(userId) {
  const { data, ...rest } = useLive('runs', ['agent_runs'], () =>
    must(supabase.from('agent_runs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5)),
  !!userId)
  return { runs: data ?? [], ...rest }
}
