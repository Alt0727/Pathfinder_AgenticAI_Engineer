/*
  UrgentBanner
  Bar under the nav for the single most urgent deadline:
  "● LIVE ON CAMPUS  Infosys drive registration closes tonight at 11:59 PM ·
  Placement Cell  6h 12m left  [Open form]  ✕". Dismissing fades it up and out
  (180 ms), and it stays hidden until reload.

  Props:
    items:    all items
    onOpen:   function(item), called by "Open form" (opens the detail pop-up)
    maxHours: optional. Only show the banner if the deadline is within this many
              hours (e.g. 24). Leave it out to always show the most urgent one.

  Needs: shadcn button; src/lib/time.js
*/
import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { prefersReducedMotion } from "@/lib/motion"
import { hoursUntil, timeLeft, upcomingDeadlines, useNow, whenText } from "@/lib/time"

export function UrgentBanner({ items, onOpen, maxHours }) {
  const now = useNow()
  const [dismissedId, setDismissedId] = useState(null)
  const [leavingId, setLeavingId] = useState(null)
  const top = upcomingDeadlines(items, now)[0]

  if (!top || top.id === dismissedId) return null
  if (maxHours && hoursUntil(top.deadline_at, now) > maxHours) return null

  return (
    <div
      role="status"
      className={`border-b border-[rgba(242,138,60,0.28)] bg-[linear-gradient(90deg,rgba(242,138,60,0.10),rgba(9,13,11,0.9)_40%)] transition-[opacity,transform] duration-[180ms] ease-[cubic-bezier(0.4,0,1,1)] ${
        leavingId === top.id ? "-translate-y-1.5 opacity-0" : ""
      }`}
      onTransitionEnd={(e) => e.target === e.currentTarget && leavingId === top.id && setDismissedId(top.id)}
    >
      <div className="mx-auto flex min-h-[50px] max-w-[1440px] flex-wrap items-center gap-3.5 px-5 py-2 sm:px-10">
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full bg-signal shadow-[0_0_0_4px_var(--signal-soft),0_0_12px_rgba(242,138,60,0.6)]"
        />
        <span className="font-code text-xs font-semibold tracking-[0.12em] text-signal uppercase">Live on campus</span>
        <span className="min-w-0 flex-[1_1_320px] text-[15px] font-medium">
          {top.title} closes {whenText(top.deadline_at)} · {top.organizer ?? top.source_group}
        </span>
        <span className="font-code text-[13px] text-signal">{timeLeft(top.deadline_at, now)} left</span>
        <Button variant="signal" size="sm" onClick={() => onOpen(top)}>
          Open form
        </Button>
        <Button variant="ghost" size="icon" aria-label="Dismiss" onClick={() => (prefersReducedMotion() ? setDismissedId(top.id) : setLeavingId(top.id))}>
          <X className="size-[18px]" />
        </Button>
      </div>
    </div>
  )
}
