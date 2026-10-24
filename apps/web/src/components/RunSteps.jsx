/*
  RunSteps
  "How the agent decided": the latest agent run, step by step. Every tool the
  agent called, in plain words, with what it was about and whether code allowed
  it (✓) or refused it (✗ + why). Grows live while the agent works.
  Collapsed by default (one line); open it to see the steps.

  Props:
    run: the newest agent_runs row (useRuns), or null

  Needs: src/lib/adapt.js (stepWords)
*/
import { Check, ChevronRight, X } from "lucide-react"
import { stepWords } from "@/lib/adapt"

const TRIGGER = {
  new_card: "a new card",
  card_changed: "a card change",
  plan_week: "Generate plan",
  chat: "your message",
  answer: "your answer",
}

// The most useful words in a step's arguments: what it was about
function about(step) {
  const a = step.args ?? {}
  return a.title ?? a.question ?? a.summary ?? (a.key ? `${a.key} = ${a.value}` : null) ?? a.reason ?? ""
}

export function RunSteps({ run }) {
  if (!run || !run.steps?.length) return null
  const running = run.status === "running"

  return (
    <details className="group rounded-xl border bg-deep/60 text-[13px] [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-muted-foreground hover:text-foreground">
        <ChevronRight aria-hidden="true" className="size-4 transition-transform group-open:rotate-90" />
        How the agent decided · {run.steps.length} {run.steps.length === 1 ? "step" : "steps"} · started by {TRIGGER[run.trigger] ?? run.trigger}
        {running && <span className="ml-auto size-2 animate-pulse rounded-full bg-teal" aria-label="working" />}
      </summary>
      <ol className="flex flex-col gap-1.5 border-t px-3.5 py-3">
        {run.steps.map((s, i) => {
          const refused = s.result?.ok === false
          return (
            <li key={i} className="flex items-start gap-2.5">
              <span
                aria-label={refused ? "refused" : "done"}
                className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full ${refused ? "bg-destructive/20 text-destructive" : "bg-teal/20 text-teal"}`}
              >
                {refused ? <X className="size-3" /> : <Check className="size-3" />}
              </span>
              <span className="min-w-0">
                <span className="font-medium">{stepWords(s.tool)}</span>
                {about(s) && <span className="text-muted-foreground"> · {about(s)}</span>}
                {refused && <span className="block text-xs text-destructive">Refused by code: {s.result.error}</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </details>
  )
}
