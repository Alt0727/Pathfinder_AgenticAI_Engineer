/*
  ClosingSoonStrip
  Orange-edged bar: "CLOSING SOON  [6h] Infosys drive registration  [2d] Mock
  interview drive sign-up …   See all". The nearest countdown is solid orange.

  Props:
    items:     all items
    onOpen:    function(item), called when a chip is clicked
    onSeeAll:  function(), called by "See all" (App opens the deadlines dropdown)
    limit:     optional, how many chips to show (default 4)

  Needs: CountdownPill.jsx; src/lib/time.js
*/
import { CountdownPill } from "@/components/CountdownPill"
import { upcomingDeadlines, useNow } from "@/lib/time"

export function ClosingSoonStrip({ items, onOpen, onSeeAll, limit = 4 }) {
  const now = useNow()
  const deadlines = upcomingDeadlines(items, now).slice(0, limit)
  if (deadlines.length === 0) return null

  return (
    <div
      role="region"
      aria-label="Closing soon"
      className="flex flex-wrap items-center gap-3 rounded-xl border border-signal-line bg-[linear-gradient(90deg,rgba(242,138,60,0.10),rgba(20,26,23,0.85)_55%)] px-3.5 py-2.5"
    >
      <span className="font-code text-xs font-semibold tracking-[0.12em] whitespace-nowrap text-signal uppercase">
        Closing soon
      </span>
      <div className="flex min-w-0 flex-[1_1_400px] gap-2 overflow-x-auto md:flex-wrap md:overflow-visible">
        {deadlines.map((d, i) => (
          <button
            key={d.id}
            onClick={() => onOpen(d)}
            className="flex h-8 shrink-0 items-center gap-2 rounded-lg border border-line-2 bg-deep pr-3 pl-1.5 text-[13px] font-medium whitespace-nowrap transition-colors hover:border-signal-line"
          >
            <CountdownPill deadline={d.deadline_at} now={now} hot={i === 0} />
            {d.title}
          </button>
        ))}
      </div>
      <button
        onClick={onSeeAll}
        className="h-[34px] rounded-lg px-3 text-[13px] font-medium whitespace-nowrap text-signal hover:bg-[rgba(243,239,230,0.06)]"
      >
        See all
      </button>
    </div>
  )
}
