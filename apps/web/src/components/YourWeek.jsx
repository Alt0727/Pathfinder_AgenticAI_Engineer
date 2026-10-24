/*
  YourWeek
  The middle panel, "Your way through the city" (panel tag YOUR WEEK): the date
  range and stop count, Plan A / Plan B + Generate plan, the timetable import,
  the Ask box with the Lines legend, and the 7-day transit calendar.

  Props:
    items:          all items (for the Ask box)
    calendarItems:  items to show on the calendar (the active plan's items)
    suggestedIds:   ids in the active plan that the AI suggested
    plans, activePlanId, onSelectPlan, onGenerate, generating:  see PlanBar.jsx
    onOpen:         function(item)
    onAsk:          optional, see AskBox.jsx
    timetableCount, onOpenTimetable:  see TimetableImport.jsx (the dialog is TimetableReview)
    questions, onAnswer:  the agent's pending questions, see AgentQuestion.jsx
    run:            the newest agent run, see RunSteps.jsx
    conflicts:      this week's clashes, see ClashNote.jsx
    ringIds, agentProgress:  passed to WeekCalendar (sage rings; transit-line progress)
    planStatus:     optional { state: "working" | "ready" | "error", text, changes?,
                    onReview?, onUndo? }, shown as a status line under the header

  Needs: PlanBar.jsx, PillarLegend.jsx, AskBox.jsx, WeekCalendar.jsx, TimetableImport.jsx,
         AgentQuestion.jsx, RunSteps.jsx, ClashNote.jsx;
         src/lib/pillars.js (panelClass); date-fns
*/
import { addDays, format } from "date-fns"
import { AgentQuestion } from "@/components/AgentQuestion"
import { AskBox } from "@/components/AskBox"
import { ClashNote } from "@/components/ClashNote"
import { PillarLegend } from "@/components/PillarLegend"
import { PlanBar } from "@/components/PlanBar"
import { RunSteps } from "@/components/RunSteps"
import { TimetableImport } from "@/components/TimetableImport"
import { WeekCalendar } from "@/components/WeekCalendar"
import { panelClass } from "@/lib/pillars"

export function YourWeek({
  items,
  calendarItems,
  suggestedIds,
  plans,
  activePlanId,
  onSelectPlan,
  onGenerate,
  generating,
  onOpen,
  onAsk,
  timetableCount = 0,
  onOpenTimetable,
  questions = [],
  onAnswer,
  run = null,
  conflicts = { timetable: [], plan: [] },
  ringIds = [],
  agentProgress = null,
  planStatus = null,
}) {
  const start = new Date()
  const end = addDays(start, 6)
  const range = `${format(start, "EEE d")} – ${format(end, "EEE d MMM")}`
  const count = calendarItems.length

  return (
    <section id="week" aria-labelledby="week-h" className={`flex min-w-0 flex-col gap-[18px] p-[22px] ${panelClass}`}>
      <span className="panel-tag">Your week</span>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="week-h" className="text-[28px] leading-none lg:text-[34px]">Your way through the city</h2>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {range} · {count} {count === 1 ? "stop" : "stops"} on your route
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <TimetableImport count={timetableCount} onOpen={onOpenTimetable} />
          <PlanBar
            plans={plans}
            activeId={activePlanId}
            onSelect={onSelectPlan}
            onGenerate={onGenerate}
            generating={generating}
          />
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`-mt-2 flex min-h-5 flex-wrap items-center gap-x-2 text-[13px] ${
          planStatus?.state === "error" ? "text-destructive" : planStatus?.state === "ready" ? "text-sage" : "text-muted-foreground"
        }`}
      >
        {planStatus && (
          <span key={planStatus.text} className="animate-in duration-[180ms] fade-in-0">
            {planStatus.text}
          </span>
        )}
        {planStatus?.state === "ready" && (
          <>
            {planStatus.onReview && (
              <>
                <span aria-hidden="true">·</span>
                <button onClick={planStatus.onReview} className="font-medium underline-offset-4 hover:underline">
                  Review
                </button>
              </>
            )}
            {planStatus.onUndo && (
              <>
                <span aria-hidden="true">·</span>
                <button onClick={planStatus.onUndo} className="font-medium underline-offset-4 hover:underline">
                  Undo
                </button>
              </>
            )}
          </>
        )}
      </p>

      <AgentQuestion questions={questions} onAnswer={onAnswer} />
      <RunSteps run={run} />

      <AskBox items={items} onOpen={onOpen} onAsk={onAsk} aside={<PillarLegend />} />
      <WeekCalendar
        items={calendarItems}
        onOpen={onOpen}
        suggestedIds={suggestedIds}
        ringIds={ringIds}
        dimmed={planStatus?.state === "working"}
        progress={agentProgress}
      />
      <ClashNote conflicts={conflicts} />
    </section>
  )
}
