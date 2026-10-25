// app-api: the ONLY way the browser writes anything (spec: unmute-integration.md §2).
// auth (verified token → user id) → rate limit → route by action.
// Body { action, ...params } → { ok: true, ... } | { ok: false, error }.
import { db } from '../_shared/supabase.ts'
import { getUserFromRequest } from '../_shared/auth.ts'
import { corsHeaders, json } from '../_shared/cors.ts'
import { agentActions } from './actions/agent.ts'
import { cardActions } from './actions/cards.ts'
import { demoActions } from './actions/demo.ts'
import { entryActions } from './actions/entries.ts'
import { groupActions } from './actions/groups.ts'
import { profileActions } from './actions/profile.ts'
import { slotActions } from './actions/slots.ts'
import { timetableActions } from './actions/timetable.ts'

type Handler = (params: Record<string, unknown>, ctx: { userId: string }) => Promise<Record<string, unknown>>

const ACTIONS: Record<string, Handler> = {
  ...profileActions, ...groupActions, ...cardActions, ...entryActions,
  ...slotActions, ...timetableActions, ...agentActions, ...demoActions,
}

const MAX_BODY = 7_000_000   // a ~5 MB timetable image as base64

// Abuse limits (security-privacy.md): counted from the rows each action creates, so no extra state.
async function overLimit(action: string, userId: string): Promise<string | null> {
  const since = (seconds: number) => new Date(Date.now() - seconds * 1000).toISOString()

  if (action === 'groups.add') {
    const { count } = await db.from('group_invites').select('id', { count: 'exact', head: true })
      .eq('requested_by', userId).gte('created_at', since(3600))
    return (count ?? 0) >= 5 ? 'max 5 group links per hour' : null
  }
  if (['chat.send', 'question.answer', 'plan.week'].includes(action)) {
    const { count } = await db.from('agent_runs').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).in('trigger', ['chat', 'answer', 'plan_week']).gte('created_at', since(60))
    return (count ?? 0) >= 5 ? 'max 5 agent runs per minute' : null
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })   // browser preflight
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405)
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return json({ ok: false, error: 'request too large' }, 413)

  const userId = await getUserFromRequest(req)
  if (!userId) return json({ ok: false, error: 'unauthorized' }, 401)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid JSON' }, 400)
  }

  // user_id in the body is ignored: identity only ever comes from the verified token.
  const { action, user_id: _ignored, ...params } = body ?? {}
  const handler = typeof action === 'string' ? ACTIONS[action] : undefined
  if (!handler) return json({ ok: false, error: `unknown action: ${String(action)}` }, 400)

  try {
    const limited = await overLimit(action as string, userId)
    if (limited) return json({ ok: false, error: limited }, 429)

    const result = await handler(params, { userId })
    return json(result, result.ok ? 200 : 400)
  } catch (err) {
    console.error(action, 'failed', err instanceof Error ? err.message : err)
    return json({ ok: false, error: 'server error' }, 500)
  }
})
