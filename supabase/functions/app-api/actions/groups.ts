import { db } from '../../_shared/supabase.ts'

// Only real WhatsApp group invite links (rate limit: 5/hour, enforced in index.ts).
const INVITE = /^https:\/\/chat\.whatsapp\.com\/(invite\/)?[A-Za-z0-9]{10,}$/

// groups.add { invite_link } → group_invites row (pending); the listener joins it via realtime.
async function add(p: Record<string, unknown>, ctx: { userId: string }) {
  const link = typeof p.invite_link === 'string' ? p.invite_link.trim() : ''
  if (!INVITE.test(link)) return { ok: false, error: 'not a WhatsApp group invite link (https://chat.whatsapp.com/…)' }

  const { data, error } = await db
    .from('group_invites')
    .insert({ invite_link: link, requested_by: ctx.userId })
    .select('id')
    .single()
  if (error) throw error
  return { ok: true, invite_id: data.id }
}

export const groupActions = { 'groups.add': add }
