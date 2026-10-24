import { supabase } from '@/lib/supabase'
import { must, useLive } from '@/hooks/useLive'

// The user's interests (tags). `ready` tells "no profile yet" (→ interests picker) apart from "still loading".
export function useProfile(userId) {
  const { data, loading, ...rest } = useLive('profile', ['profiles'], async () => {
    const rows = await must(supabase.from('profiles').select('interests').eq('id', userId))
    return rows[0]?.interests ?? []
  }, !!userId)
  return { interests: data ?? [], ready: !loading && data !== null, loading, ...rest }
}
