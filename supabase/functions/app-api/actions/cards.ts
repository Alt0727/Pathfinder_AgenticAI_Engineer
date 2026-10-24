import { db } from '../../_shared/supabase.ts'

const ACTIONS = ['added', 'skipped', 'saved']
const UUID = /^[0-9a-f-]{36}$/i

// card.act { card_id, action } → upsert card_actions. This is how the feed learns (get_feed).
async function act(p: Record<string, unknown>, ctx: { userId: string }) {
  const cardId = String(p.card_id ?? '')
  const action = String(p.action ?? '')
  if (!UUID.test(cardId)) return { ok: false, error: 'invalid card_id' }
  if (!ACTIONS.includes(action)) return { ok: false, error: `action must be one of: ${ACTIONS.join(', ')}` }

  const { data: card } = await db.from('cards').select('id').eq('id', cardId).maybeSingle()
  if (!card) return { ok: false, error: 'card not found' }

  const { error } = await db.from('card_actions').upsert(
    { user_id: ctx.userId, card_id: cardId, action, created_at: new Date().toISOString() },
    { onConflict: 'user_id,card_id' },
  )
  if (error) throw error
  return { ok: true }
}

export const cardActions = { 'card.act': act }
