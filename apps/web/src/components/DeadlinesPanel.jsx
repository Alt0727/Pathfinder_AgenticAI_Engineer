/*
  DeadlinesPanel
  Right column, "Signals on the horizon" (panel tag DEADLINES): "4 open · nearest
  first", the horizon chart, the nearest deadline in an orange card with a live
  countdown ("CLOSES IN 6h 12m 07s"; its border brightens once under an hour),
  then the next few as rows ("2 days / Mock interview drive sign-up /
  Sat 17 Oct, 8:00 PM · Placement Cell").
  "View all deadlines" opens the deadlines dropdown in the nav.

  Props:
    items:     all items
    onOpen:    function(item)
    onViewAll: function(), called by "View all deadlines"
    limit:     optional, how many deadlines to list (default 4)

  Needs: HorizonChart.jsx; src/lib/time.js; src/lib/pillars.js (panelClass)
*/
import { HorizonChart } from "@/components/HorizonChart"
import { panelClass } from "@/lib/pillars"
import { daysLeftLabel, hoursUntil, shortDateTime, timeLeft, upcomingDeadlines, useNow } from "@/lib/time"

export function DeadlinesPanel({ items, onOpen, onViewAll, limit = 4 }) {
  const now = useNow()
  const all = upcomingDeadlines(items, now)
  const [top, ...rest] = all.slice(0, limit)

  return (
    <aside id="deadlines" aria-labelledby="dl-h" className={`flex h-full flex-col gap-3 p-[22px] ${panelClass}`}>
      <span className="panel-tag">Deadlines</span>
      <div>
        <h2 id="dl-h" className="text-[28px] leading-none">Signals on the horizon</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground">{all.length} open · nearest first</p>
      </div>

      <HorizonChart deadlines={all} now={now} />

      {!top && <p className="text-sm text-muted-foreground">No open deadlines.</p>}

      {top && (
        <button
          onClick={() => onOpen(top)}
          className={`flex w-full flex-col gap-1 rounded-xl border bg-signal-soft p-4 text-left transition-colors duration-300 ${
            hoursUntil(top.deadline_at, now) < 1 ? "border-[rgba(242,138,60,0.8)]" : "border-signal-line"
          }`}
        >
          <span className="eyebrow text-signal">Closes in</span>
          <span className="font-code text-[30px] leading-[1.15] font-medium tracking-[-0.02em] text-signal [text-shadow:0_0_18px_rgba(242,138,60,0.35)]">
            {timeLeft(top.deadline_at, now, true)}
          </span>
          <span className="text-[15px] font-semibold">{top.title}</span>
          <span className="text-[13px] text-muted-foreground">
            {shortDateTime(top.deadline_at)} · {top.organizer ?? top.source_group}
          </span>
        </button>
      )}

      <div>
        {rest.map((d) => (
          <button
            key={d.id}
            onClick={() => onOpen(d)}
            className="grid w-full grid-cols-[62px_1fr] gap-x-3 gap-y-[3px] border-t px-1 py-3 text-left"
          >
            <span className="font-code row-span-2 pt-0.5 text-[13px] font-semibold text-signal">
              {daysLeftLabel(d.deadline_at, now)}
            </span>
            <span className="text-sm font-semibold">{d.title}</span>
            <span className="text-xs text-muted-foreground">
              {shortDateTime(d.deadline_at)} · {d.organizer ?? d.source_group}
            </span>
          </button>
        ))}
      </div>

      <div className="flex-1" />
      <button
        onClick={onViewAll}
        className="h-[34px] rounded-lg text-[13px] font-medium text-muted-foreground hover:bg-[rgba(243,239,230,0.06)] hover:text-foreground"
      >
        View all deadlines
      </button>
    </aside>
  )
}
