import { supabase } from '@/lib/supabase'
import { must, useLive } from '@/hooks/useLive'

// Ranked cards with score + "why" (get_feed). Re-ranks when a card or one of my actions changes.
export function useFeed(userId) {
  const { data, ...rest } = useLive('feed', ['cards', 'card_actions'], () =>
    must(supabase.rpc('get_feed', { p_user: userId, p_limit: 50 })),
  !!userId)
  return { cards: data ?? [], ...rest }
}
