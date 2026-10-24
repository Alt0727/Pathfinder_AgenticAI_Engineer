// Write tools with guardrails in code: ≤ 5 writes per run · nothing in the past · clash-free ·
// auto mode may only move/remove the agent's OWN entries. ask_user / finish end the run.
import { db } from '../../_shared/supabase.ts'
import { defaultEnd } from '../../_shared/default-end.ts'
import { toIST } from '../../_shared/time.ts'
import { cardInfo, clashes, eventEnd, noteFixedClash } from './read.ts'
import { type Ctx, isTime, isUuid, MAX_WRITES, text, type Tool } from './index.ts'

const PREFERENCE_KEYS = ['avoid_after', 'avoid_before', 'busy_days', 'max_events_per_day']

function writeBudget(ctx: Ctx) {
  return ctx.writes >= MAX_WRITES ? { ok: false, error: `write limit reached (${MAX_WRITES} per run): finish or ask_user now` } : null
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// Auto mode: a time the AGENT picks must respect the user's saved hours (avoid_after / avoid_before).
// User mode is exempt: there the user is directing the change.
async function outsideHours(ctx: Ctx, startsAt: string, endsAt: string) {
  if (ctx.mode !== 'auto') return null
  const { data } = await db.from('user_preferences').select('key, value').eq('user_id', ctx.userId).in('key', ['avoid_after', 'avoid_before'])
  const pref = Object.fromEntries((data ?? []).map((p) => [p.key, p.value]))
  const start = toIST(startsAt)!, end = toIST(endsAt)!
  const late = HHMM.test(pref.avoid_after ?? '') && (end.slice(11, 16) > pref.avoid_after || end.slice(0, 10) > start.slice(0, 10))
  const early = HHMM.test(pref.avoid_before ?? '') && start.slice(11, 16) < pref.avoid_before
  if (late) return { ok: false, error: `ends after ${pref.avoid_after}, the user's avoid_after preference: pick an earlier time or skip it` }
  if (early) return { ok: false, error: `starts before ${pref.avoid_before}, the user's avoid_before preference: pick a later time or skip it` }
  return null
}

// An entry for a card's EVENT (anything but a "Register for X" task) must sit at the card's own time:
// the agent may never invent or shift when an event happens. Clash → ask_user, not a new time.
function offEventTime(card: { starts_at: string | null } | null, title: string, startsAt: string) {
  if (!card?.starts_at || /^register for\b/i.test(title)) return null
  if (Date.parse(card.starts_at) === Date.parse(startsAt)) return null
  return { ok: false, error: `this is the event itself: it happens at ${toIST(card.starts_at)} and cannot be moved. If that time clashes, use ask_user (or skip it).` }
}

// One of this user's planned entries, with the auto-mode ownership rule applied.
async function ownEntry(ctx: Ctx, entryId: unknown) {
  if (!isUuid(entryId)) return { error: 'invalid entry_id' }
  const { data } = await db.from('plan_entries').select('*')
    .eq('id', entryId).eq('user_id', ctx.userId).eq('status', 'planned').maybeSingle()
  if (!data) return { error: 'entry not found' }
  if (ctx.mode === 'auto' && data.placed_by !== 'agent') {
    return { error: 'this entry was placed by the user: in auto mode you may not change it. Use ask_user.' }
  }
  return { entry: data }
}

export const writeTools: Tool[] = [
  {
    declaration: {
      name: 'add_entry',
      description: 'Add an entry to the plan. Refused if it is in the past, clashes with anything, or the run already made 5 writes. Leave ends_at out if no end is known.',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          starts_at: { type: 'string', description: 'ISO time with +05:30' },
          ends_at: { type: 'string', description: 'ISO time with +05:30 (optional)' },
          card_id: { type: 'string', description: 'the card this entry is for (optional)' },
          reason: { type: 'string', description: 'short, specific; the user sees it' },
        },
        required: ['title', 'starts_at', 'reason'],
      },
    },
    handler: async (args, ctx) => {
      const over = writeBudget(ctx); if (over) return over
      const title = text(args.title, 120), reason = text(args.reason)
      if (!title || !reason) return { ok: false, error: 'title and reason are required' }
      if (!isTime(args.starts_at)) return { ok: false, error: 'starts_at must be an ISO time' }
      if (args.ends_at != null && !isTime(args.ends_at)) return { ok: false, error: 'ends_at must be an ISO time' }
      if (Date.parse(args.starts_at) <= Date.now()) return { ok: false, error: 'starts_at is in the past' }

      const cardId = args.card_id != null ? args.card_id : null
      const card = cardId != null ? await cardInfo(cardId) : null
      if (cardId != null) {
        if (!card) return { ok: false, error: 'card not found' }
        // No duplicates: the same card + title already planned
        const { data: dup } = await db.from('plan_entries').select('id').eq('user_id', ctx.userId)
          .eq('card_id', cardId).eq('title', title).eq('status', 'planned').limit(1)
        if (dup?.length) return { ok: false, error: `already planned (entry ${dup[0].id})` }
        const pinned = offEventTime(card, title, args.starts_at); if (pinned) return pinned
      }

      // The card's own event → end from the card (never the model's guess); otherwise the model's end or a default.
      const fromCard = eventEnd(card, args.starts_at, title)
      const estimated = fromCard ? fromCard.estimated : args.ends_at == null
      const endsAt = fromCard?.endsAt ??
        (args.ends_at == null ? defaultEnd({ starts_at: args.starts_at, title, tags: card?.tags ?? [] }) : (args.ends_at as string))
      if (Date.parse(endsAt) <= Date.parse(args.starts_at)) return { ok: false, error: 'end must be after start' }
      // A time the agent chose itself (not the card's own event time) must respect the user's hours.
      if (!fromCard) { const off = await outsideHours(ctx, args.starts_at, endsAt); if (off) return off }

      const conflicts = await clashes(ctx.userId, args.starts_at, endsAt)
      if (conflicts.length) {
        await noteFixedClash(ctx, args.starts_at, conflicts)
        return { ok: false, error: 'clashes with existing items; pick a free time or ask_user', conflicts }
      }

      const { data, error } = await db.from('plan_entries').insert({
        user_id: ctx.userId, card_id: cardId, title, starts_at: args.starts_at, ends_at: endsAt,
        end_estimated: estimated, placed_by: 'agent', reason, run_id: ctx.runId,
      }).select('id').single()
      if (error) throw error
      ctx.writes++
      return { ok: true, entry_id: data.id, starts_at: toIST(args.starts_at), ends_at: toIST(endsAt), end_estimated: estimated }
    },
  },
  {
    declaration: {
      name: 'move_entry',
      description: 'Move a plan entry to a new time (keeps its length if ends_at is left out). In auto mode only entries you placed (placed_by agent).',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          entry_id: { type: 'string' },
          starts_at: { type: 'string', description: 'ISO time with +05:30' },
          ends_at: { type: 'string', description: 'ISO time with +05:30 (optional)' },
          reason: { type: 'string' },
        },
        required: ['entry_id', 'starts_at', 'reason'],
      },
    },
    handler: async (args, ctx) => {
      const over = writeBudget(ctx); if (over) return over
      const reason = text(args.reason)
      if (!reason) return { ok: false, error: 'reason is required' }
      const { entry, error: notOk } = await ownEntry(ctx, args.entry_id)
      if (!entry) return { ok: false, error: notOk }
      if (!isTime(args.starts_at)) return { ok: false, error: 'starts_at must be an ISO time' }
      if (args.ends_at != null && !isTime(args.ends_at)) return { ok: false, error: 'ends_at must be an ISO time' }
      if (Date.parse(args.starts_at) <= Date.now()) return { ok: false, error: 'starts_at is in the past' }
      if (entry.card_id) { const pinned = offEventTime(await cardInfo(entry.card_id), entry.title, args.starts_at); if (pinned) return pinned }

      const length = Date.parse(entry.ends_at) - Date.parse(entry.starts_at)
      const endsAt = args.ends_at != null ? (args.ends_at as string) : new Date(Date.parse(args.starts_at) + length).toISOString()
      if (Date.parse(endsAt) <= Date.parse(args.starts_at)) return { ok: false, error: 'end must be after start' }
      const off = await outsideHours(ctx, args.starts_at, endsAt); if (off) return off

      const conflicts = await clashes(ctx.userId, args.starts_at, endsAt, entry.id)
      if (conflicts.length) return { ok: false, error: 'the new time clashes; pick a free time or ask_user', conflicts }

      const { error } = await db.from('plan_entries')
        .update({ starts_at: args.starts_at, ends_at: endsAt, reason, run_id: ctx.runId })
        .eq('id', entry.id).eq('user_id', ctx.userId)
      if (error) throw error
      ctx.writes++
      return { ok: true, entry_id: entry.id, starts_at: toIST(args.starts_at), ends_at: toIST(endsAt) }
    },
  },
  {
    declaration: {
      name: 'remove_entry',
      description: 'Remove a plan entry. In auto mode only entries you placed (placed_by agent).',
      parametersJsonSchema: {
        type: 'object',
        properties: { entry_id: { type: 'string' }, reason: { type: 'string' } },
        required: ['entry_id', 'reason'],
      },
    },
    handler: async (args, ctx) => {
      const over = writeBudget(ctx); if (over) return over
      const reason = text(args.reason)
      if (!reason) return { ok: false, error: 'reason is required' }
      const { entry, error: notOk } = await ownEntry(ctx, args.entry_id)
      if (!entry) return { ok: false, error: notOk }
      const { error } = await db.from('plan_entries').update({ status: 'cancelled', reason, run_id: ctx.runId })
        .eq('id', entry.id).eq('user_id', ctx.userId)
      if (error) throw error
      ctx.writes++
      return { ok: true, entry_id: entry.id }
    },
  },
  {
    declaration: {
      name: 'save_preference',
      description: `Remember a scheduling preference for future runs. key: ${PREFERENCE_KEYS.join(' | ')} (e.g. avoid_after = 21:00, busy_days = Tue,Thu).`,
      parametersJsonSchema: {
        type: 'object',
        properties: { key: { type: 'string', enum: PREFERENCE_KEYS }, value: { type: 'string' } },
        required: ['key', 'value'],
      },
    },
    handler: async (args, ctx) => {
      const over = writeBudget(ctx); if (over) return over
      const key = text(args.key, 40), value = text(args.value, 50)
      if (!PREFERENCE_KEYS.includes(key)) return { ok: false, error: `key must be one of: ${PREFERENCE_KEYS.join(', ')}` }
      if (!value) return { ok: false, error: 'value is required' }
      if (key.startsWith('avoid_') && !HHMM.test(value)) return { ok: false, error: 'use 24-hour HH:MM, e.g. 18:00' }
      const { error } = await db.from('user_preferences').upsert({ user_id: ctx.userId, key, value }, { onConflict: 'user_id,key' })
      if (error) throw error
      ctx.writes++
      return { ok: true }
    },
  },
  {
    declaration: {
      name: 'ask_user',
      description: 'Ask the user a question with 2–4 short answer options. ENDS the run; the answer starts a new run.',
      parametersJsonSchema: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
        },
        required: ['question', 'options'],
      },
    },
    handler: async (args, ctx) => {
      const question = text(args.question, 300)
      const options = Array.isArray(args.options) ? args.options.map((o) => text(o, 80)).filter(Boolean) : []
      if (!question) return { ok: false, error: 'question is required' }
      if (options.length < 2 || options.length > 4) return { ok: false, error: 'give 2–4 options' }
      const { data, error } = await db.from('agent_questions')
        .insert({ user_id: ctx.userId, run_id: ctx.runId, question, options }).select('id').single()
      if (error) throw error
      await db.from('chat_messages').insert({ user_id: ctx.userId, role: 'agent', text: question, run_id: ctx.runId })
      return { ok: true, question_id: data.id, ends_run: true }
    },
  },
  {
    declaration: {
      name: 'finish',
      description: 'End the run with a short summary for the user naming what changed (titles + times), or why nothing did.',
      parametersJsonSchema: {
        type: 'object',
        properties: { summary: { type: 'string' } },
        required: ['summary'],
      },
    },
    handler: async (args, ctx) => {
      const summary = text(args.summary, 600)
      if (!summary) return { ok: false, error: 'summary is required' }
      // Guardrail: an auto run may not quietly skip an event that clashes with the user's timetable/entries.
      const clash = ctx.fixedClashes[0]
      if (clash) {
        return {
          ok: false,
          error: `Not allowed to finish yet: "${clash.event}" clashes with ${clash.with.join(', ')}, which you may not change. ` +
            'Ask the user with ask_user (e.g. move that one occurrence, or skip the event).',
        }
      }
      await db.from('chat_messages').insert({ user_id: ctx.userId, role: 'agent', text: summary, run_id: ctx.runId })
      return { ok: true, ends_run: true }
    },
  },
]
