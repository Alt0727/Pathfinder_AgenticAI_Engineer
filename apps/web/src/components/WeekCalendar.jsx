/*
  WeekCalendar
  The week as a transit line: a station per day (today + 6) with "YOU ARE HERE"
  over today, and a day column under each station. Each entry is a tinted tile
  with a 3px left edge in its line colour: letter roundel, title, time, place.
  Empty days are dashed. Click an entry to open the item card.
  Built with a CSS grid (shadcn's Calendar is a date picker, not a week view).
  Scrolls sideways on small screens, keeping the line aligned with the columns.

  Props:
    items:        the items to place on the calendar (already filtered by App)
    onOpen:       function(item)
    suggestedIds: optional ids the AI plan suggested (not added by the student);
                  drawn with a dashed border
    ringIds:      optional ids to mark with a one-time sage ring (just added / changed by a plan)
    dimmed:       optional true while the agent is working (contents at 60%)
    progress:     optional 0–1: the agent's real progress, drawn as a teal overlay
                  along the transit line, station by station; null hides it

  Needs: PillarBadge.jsx (PillarDot); src/lib/pillars.js; src/lib/time.js; date-fns
*/
import { addDays, format, isSameDay, startOfDay } from "date-fns"
import { PillarDot } from "@/components/PillarBadge"
import { isPhysicalPlace, pillarStyle } from "@/lib/pillars"
import { itemDate } from "@/lib/time"

export function WeekCalendar({ items, onOpen, suggestedIds = [], ringIds = [], dimmed = false, progress = null }) {
  const today = startOfDay(new Date())
  const days = Array.from({ length: 7 }, (_, n) => addDays(today, n))

  return (
    <div className="overflow-x-auto pt-3.5 pb-1">
      <div className="flex min-w-[640px] flex-col gap-3">
        {/* Transit line: solid teal up to today, faded after */}
        <div
          aria-hidden="true"
          className="relative grid grid-cols-7 gap-1.5 pt-1 before:absolute before:top-[11px] before:right-[7%] before:left-[7%] before:h-[3px] before:rounded-[2px] before:bg-[linear-gradient(90deg,var(--teal)_0,var(--teal)_8%,rgba(79,201,180,0.35)_8%,rgba(79,201,180,0.35))] before:content-['']"
        >
          {progress !== null && (
            <span
              className="absolute top-[11px] left-[7%] h-[3px] w-[86%] origin-left rounded-[2px] bg-teal shadow-[0_0_10px_rgba(79,201,180,0.6)] transition-transform duration-[240ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
              style={{ transform: `scaleX(${Math.round(progress * 6) / 6})` }}
            />
          )}
          {days.map((day, n) => {
            const isToday = n === 0
            return (
              <span key={day.toISOString()} className="relative flex flex-col items-center gap-1.5">
                {isToday && (
                  <b className="font-code absolute -top-4 text-[9px] font-semibold tracking-[0.12em] whitespace-nowrap text-teal">
                    YOU ARE HERE
                  </b>
                )}
                <i
                  className={`size-4 rounded-full border-[3px] ${
                    isToday
                      ? "border-teal bg-teal shadow-[0_0_0_5px_rgba(79,201,180,0.18),0_0_14px_rgba(79,201,180,0.6)]"
                      : "border-[rgba(79,201,180,0.6)] bg-background"
                  }`}
                />
                <span
                  className={`font-code text-[11px] font-medium tracking-[0.06em] uppercase ${
                    isToday ? "text-teal" : "text-soft"
                  }`}
                >
                  {format(day, "EEE d")}
                </span>
              </span>
            )
          })}
        </div>

        <div className={`grid grid-cols-7 gap-1.5 transition-opacity duration-200 ${dimmed ? "opacity-60" : ""}`}>
          {days.map((day, n) => {
            const dayItems = items
              .filter((i) => itemDate(i) && isSameDay(new Date(itemDate(i)), day))
              .sort((a, b) => new Date(itemDate(a)) - new Date(itemDate(b)))
            const isToday = n === 0
            const empty = dayItems.length === 0

            return (
              <div
                key={day.toISOString()}
                aria-label={format(day, "EEE d")}
                data-day={format(day, "yyyy-MM-dd")}
                className={`relative flex min-h-[290px] flex-col gap-2 rounded-xl border px-[7px] py-2.5 before:absolute before:-top-[7px] before:left-1/2 before:h-[7px] before:w-px before:bg-[rgba(79,201,180,0.35)] before:content-[''] ${
                  isToday
                    ? "border-[rgba(79,201,180,0.6)] bg-[linear-gradient(180deg,rgba(79,201,180,0.07),rgba(9,13,11,0.45)_40%)]"
                    : empty
                      ? "border-dashed bg-transparent"
                      : "bg-[rgba(9,13,11,0.45)]"
                }`}
              >
                {dayItems.map((item) => {
                  const style = pillarStyle[item.pillar] ?? pillarStyle.announcement
                  const suggested = suggestedIds.includes(item.id)
                  const time = item.starts_at
                    ? format(new Date(item.starts_at), "h:mm a")
                    : `Due ${format(new Date(item.deadline_at), "h:mm a")}`
                  return (
                    <button
                      key={item.id}
                      onClick={() => onOpen(item)}
                      aria-label={`${style.label}: ${item.title}${item.cancelled ? " (cancelled)" : ""}`}
                      title={suggested ? "Placed by the agent" : undefined}
                      className={`relative flex w-full flex-col gap-1 rounded-lg border border-l-[3px] p-2 text-left transition-[transform,border-color] duration-150 hover:-translate-y-px hover:border-line-2 ${style.tile} ${
                        suggested ? "border-dashed" : ""
                      } ${item.cancelled ? "opacity-60" : ""}`}
                    >
                      {ringIds.includes(item.id) && <span aria-hidden="true" className="sage-ring" />}
                      <PillarDot pillar={item.pillar} />
                      <span className={`line-clamp-3 text-[13px] leading-[1.3] font-medium ${item.cancelled ? "line-through" : ""}`}>{item.title}</span>
                      {item.cancelled && <span className="text-[11px] font-semibold tracking-wide text-destructive uppercase">Cancelled</span>}
                      <span className="text-xs text-muted-foreground">
                        {time}
                        {item.end_estimated ? " ~" : ""}
                      </span>
                      {isPhysicalPlace(item.venue) && (
                        <span className="flex items-baseline gap-1.5 text-[11.5px] leading-[1.3] text-muted-foreground">
                          <span aria-hidden="true" className="size-1.5 shrink-0 translate-y-px rounded-full border-2 border-soft" />
                          <span className="line-clamp-2">{item.venue}</span>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
