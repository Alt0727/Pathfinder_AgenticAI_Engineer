// The first message: everything the agent needs, fetched by code BEFORE the first Gemini call.
// Saves ~3 tool round trips per run; the read tools are still there for fresh data after writes.
import { db } from '../_shared/supabase.ts'
import { toIST, weekRange } from '../_shared/time.ts'
import { preferences, weekItems } from './tools/read.ts'
import { triggerLine } from './prompt.ts'

const CARD_FIELDS = 'id, type, title, summary, tags, deadline_at, starts_at, ends_at, location, link, status, source_group_name'

// Card times in IST for the model.
const ist = (c: Record<string, unknown>) => ({
  ...c, deadline_at: toIST(c.deadline_at as string), starts_at: toIST(c.starts_at as string), ends_at: toIST(c.ends_at as string),
})

export async function buildContext(userId: string, trigger: string, payload: Record<string, unknown>) {
  const week = weekRange()
  const prefs = await preferences(userId)
  const sections: string[] = [triggerLine(trigger, payload, week)]

  if (trigger === 'new_card') {
    const ids = (payload.card_ids as string[] | undefined) ?? []
    const { data } = await db.from('cards').select(CARD_FIELDS).in('id', ids)
    sections.push(`New cards:\n${JSON.stringify((data ?? []).map(ist), null, 1)}`)
  }

  if (trigger === 'card_changed') {
    const changes = (payload.changes as { card_id: string; old?: Record<string, unknown>; new?: Record<string, unknown> }[] | undefined) ?? []
    // AI #1 reports old → new times in UTC; the agent sees every time in IST (+05:30)
    const inIST = (o: Record<string, unknown> = {}) =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, k.endsWith('_at') && typeof v === 'string' ? toIST(v) : v]))
    sections.push(`Changes:\n${JSON.stringify(changes.map((c) => ({ ...c, old: inIST(c.old), new: inIST(c.new) })), null, 1)}`)
    const { data } = await db.from('plan_entries').select('id, title, starts_at, ends_at, placed_by, card_id')
      .eq('user_id', userId).eq('status', 'planned').in('card_id', changes.map((c) => c.card_id))
    sections.push(`Linked plan entries:\n${JSON.stringify((data ?? []).map(ist), null, 1)}`)
  }

  if (['plan_week', 'chat', 'answer'].includes(trigger)) {
    const { data } = await db.rpc('get_feed', { p_user: userId, p_limit: 15 })
    sections.push(`Top feed cards:\n${JSON.stringify((data ?? []).map((c: Record<string, unknown>) => ist({
      id: c.id, type: c.type, title: c.title, tags: c.tags, deadline_at: c.deadline_at, starts_at: c.starts_at,
      ends_at: c.ends_at, location: c.location, why: c.why,
    })), null, 1)}`)
  }

  if (trigger === 'chat' || trigger === 'answer') {
    // Short memory: the last ~6 messages from the past 24 h, so "actually move it to Sunday" works.
    const { data } = await db.from('chat_messages').select('role, text, created_at').eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 86400_000).toISOString())
      .order('created_at', { ascending: false }).limit(6)
    const recent = (data ?? []).reverse().map((m) => `${m.role}: ${m.text}`)
    if (recent.length) sections.push(`Recent conversation:\n${recent.join('\n')}`)
  }

  if (trigger === 'answer') {
    sections.push(`The question had options: ${JSON.stringify(payload.options ?? [])}.`)
    const { data: q } = await db.from('agent_questions').select('run_id').eq('id', String(payload.question_id ?? '')).maybeSingle()
    if (q) {
      const { data: run } = await db.from('agent_runs').select('summary, steps').eq('id', q.run_id).maybeSingle()
      if (run?.summary) sections.push(`The run that asked it: ${run.summary}`)
    }
  }

  if (trigger === 'chat' && payload.pending_question_id) {
    const { data: q } = await db.from('agent_questions').select('question, options')
      .eq('id', String(payload.pending_question_id)).eq('status', 'pending').maybeSingle()
    if (q) sections.push(`Pending question: "${q.question}" (options ${JSON.stringify(q.options)}). The user's message may be answering it.`)
  }

  sections.push(`Next 7 days (${week.from} → ${week.to}), plan + timetable:\n${JSON.stringify(await weekItems(userId, week.from, week.to), null, 1)}`)
  sections.push(`Preferences:\n${JSON.stringify({ saved: prefs.saved, tag_affinity: prefs.tag_affinity })}`)

  return { message: sections.join('\n\n'), interests: prefs.interests as string[] }
}
