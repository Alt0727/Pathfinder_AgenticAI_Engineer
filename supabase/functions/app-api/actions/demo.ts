// demo.reset → FULL demo reset (the "Reset demo" button), same as supabase/reset.sql: delete every
// (anonymous) user (cascades to interests, timetables, invites, entries, runs, questions, chat…),
// all cards and raw messages. A hackathon demo control, not a product feature.
import { db } from '../../_shared/supabase.ts'

async function reset() {
  let users = 0
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (error) throw error
    if (!data.users.length) break
    for (const u of data.users) {
      const { error: delError } = await db.auth.admin.deleteUser(u.id)
      if (delError) throw delError
      users++
    }
  }
  const cards = await db.from('cards').delete().not('id', 'is', null).select('id')
  if (cards.error) throw cards.error
  const raw = await db.from('raw_messages').delete().not('id', 'is', null)
  if (raw.error) throw raw.error

  console.log('demo reset', users, 'user(s),', cards.data.length, 'card(s)')
  return { ok: true, users, cards: cards.data.length }
}

export const demoActions = { 'demo.reset': reset }
