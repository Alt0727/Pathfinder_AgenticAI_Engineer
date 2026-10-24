// The agent's tools. Which ones a run GETS depends on its mode, and handlers re-check the mode:
// auto runs (new_card, card_changed, plan_week) never receive override_slot.
import type { FunctionDeclaration } from '../../_shared/gemini.ts'
import { readTools } from './read.ts'
import { userOnlyTools } from './user-only.ts'
import { writeTools } from './write.ts'

export type Mode = 'auto' | 'user'
// Fixed by code for the whole run: the model never supplies a user id.
// fixedClashes: card events seen clashing with the timetable / user entries (auto mode must ask about them).
export type Ctx = {
  userId: string; runId: string; mode: Mode; writes: number
  fixedClashes: { event: string; with: string[] }[]
}
export type Result = { ok: boolean; error?: string; [key: string]: unknown }
export type Tool = {
  declaration: FunctionDeclaration
  handler: (args: Record<string, unknown>, ctx: Ctx) => Promise<Result>
}

export const MAX_WRITES = 5

// Built on call, not at load time (the tool files import this module, so their lists may not exist yet).
export function toolsFor(mode: Mode): Tool[] {
  const core = [...readTools, ...writeTools]
  return mode === 'user' ? [...core, ...userOnlyTools] : core
}

// Runs one tool call. Never throws: errors come back as { ok: false, error } for the model to see.
export async function runTool(tools: Tool[], name: string, args: Record<string, unknown>, ctx: Ctx): Promise<Result> {
  const tool = tools.find((t) => t.declaration.name === name)
  if (!tool) return { ok: false, error: `tool ${name} is not available in ${ctx.mode} mode` }
  try {
    return await tool.handler(args ?? {}, ctx)
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// Shared argument checks. Function declarations (not consts): the tool files import these while this
// module is still loading (circular import), and declarations are ready before any code runs.
export function isDate(v: unknown): v is string { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) }
export function isTime(v: unknown): v is string { return typeof v === 'string' && !Number.isNaN(Date.parse(v)) }
export function isUuid(v: unknown): v is string { return typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) }
export function text(v: unknown, max = 200): string { return typeof v === 'string' ? v.trim().slice(0, max) : '' }
