import { supabase } from '@/lib/supabase'
import { must, useLive } from '@/hooks/useLive'

// Every campus card from the last 30 days (active and cancelled), newest first. Cards are shared:
// RLS lets any signed-in user read them. Re-loads on any card change (AI #1 creates / updates / cancels).
export function useCards(userId) {
  const { data, ...rest } = useLive('cards', ['cards'], () =>
    must(
      supabase
        .from('cards')
        .select('id, type, title, summary, tags, deadline_at, starts_at, ends_at, location, link, status, source_group_id, source_group_name, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString())
        .order('created_at', { ascending: false }),
    ),
  !!userId)
  return { cards: data ?? [], ...rest }
}
