// chat.send · question.answer · plan.week: user-started planner-agent runs (unmute-integration.md §2).
// The rate limit (5 runs / user / minute) is applied in index.ts before these run.
import { db } from '../../_shared/supabase.ts'
import { weekRange } from '../../_shared/time.ts'

const AGENT_URL = `${Deno.env.get('SUPABASE_URL')}/functions/v1/planner-agent`
const AGENT_SECRET = Deno.env.get('AGENT_SECRET') ?? ''
const UUID = /^[0-9a-f-]{36}$/i

// Lazy cleanup (no cron): drop this user's chat + runs older than 7 days, then start the run.
// The agent replies { run_id } at once and keeps working in the background.
async function startRun(userId: string, trigger: string, payload: Record<string, unknown>) {
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
  await db.from('chat_messages').delete().eq('user_id', userId).lt('created_at', weekAgo)
  await db.from('agent_runs').delete().eq('user_id', userId).lt('created_at', weekAgo)   // questions cascade

  const res = await fetch(AGENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-secret': AGENT_SECRET },
    body: JSON.stringify({ trigger, user_id: userId, payload }),
  })
  const reply = await res.json().catch(() => ({}))
  if (!reply.run_id) {
    console.error('agent did not start', trigger, res.status)
    return { ok: false, error: 'the agent could not start, try again' }
  }
  return { ok: true, run_id: reply.run_id }
}

// plan.week → "Plan my next 7 days" (auto mode)
function planWeek(_p: Record<string, unknown>, ctx: { userId: string }) {
  return startRun(ctx.userId, 'plan_week', weekRange())
}

// chat.send { text } → user-mode run. A message typed while a question is pending counts as its answer.
async function chatSend(p: Record<string, unknown>, ctx: { userId: string }) {
  const text = typeof p.text === 'string' ? p.text.trim() : ''
  if (!text) return { ok: false, error: 'message is empty' }
  if (text.length > 500) return { ok: false, error: 'message is too long (max 500 characters)' }

  const { error } = await db.from('chat_messages').insert({ user_id: ctx.userId, role: 'user', text })
  if (error) throw error

  const { data: pending } = await db.from('agent_questions').select('id')
    .eq('user_id', ctx.userId).eq('status', 'pending').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (pending) await db.from('agent_questions').update({ status: 'answered', answer: text }).eq('id', pending.id)

  return startRun(ctx.userId, 'chat', { text, ...(pending ? { pending_question_id: pending.id } : {}) })
}

// question.answer { question_id, answer } → mark answered, echo to chat, start an `answer` run (user mode)
async function questionAnswer(p: Record<string, unknown>, ctx: { userId: string }) {
  const questionId = String(p.question_id ?? '')
  const answer = typeof p.answer === 'string' ? p.answer.trim().slice(0, 200) : ''
  if (!UUID.test(questionId)) return { ok: false, error: 'invalid question_id' }
  if (!answer) return { ok: false, error: 'answer is empty' }

  // Only the user's own, still-pending question; answering twice is refused.
  const { data: q, error } = await db.from('agent_questions')
    .update({ status: 'answered', answer })
    .eq('id', questionId).eq('user_id', ctx.userId).eq('status', 'pending')
    .select('id, question, options').maybeSingle()
  if (error) throw error
  if (!q) return { ok: false, error: 'question not found or already answered' }

  await db.from('chat_messages').insert({ user_id: ctx.userId, role: 'user', text: answer })
  const run = await startRun(ctx.userId, 'answer', { question_id: q.id, question: q.question, options: q.options, answer })
  // The agent didn't start: put the question back in the inbox so the user can try again.
  if (!run.ok) await db.from('agent_questions').update({ status: 'pending', answer: null }).eq('id', q.id)
  return run
}

export const agentActions = { 'chat.send': chatSend, 'question.answer': questionAnswer, 'plan.week': planWeek }
