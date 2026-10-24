import { supabase } from '@/lib/supabase'
import { must, useLive } from '@/hooks/useLive'

// The invite links this user added, newest first; status updates live (pending → joined / failed).
export function useGroups(userId) {
  const { data, ...rest } = useLive('groups', ['group_invites'], () =>
    must(supabase.from('group_invites').select('*').eq('requested_by', userId).order('created_at', { ascending: false })),
  !!userId)
  return { groups: data ?? [], ...rest }
}
