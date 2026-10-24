/*
  CountdownPill
  The small mono tag with time left: "6h", "2d". The nearest deadline is "hot"
  (solid orange); the others are orange text on a soft orange tint.

  Props:
    deadline: ISO date string
    now:      current time in ms (from useNow)
    hot:      optional true/false

  Needs: src/lib/time.js
*/
import { shortLeft } from "@/lib/time"

export function CountdownPill({ deadline, now, hot = false }) {
  return (
    <span
      className={`font-code shrink-0 rounded-sm px-2 py-0.5 text-[11px] font-semibold ${
        hot ? "bg-signal text-signal-ink" : "bg-signal-soft text-signal"
      }`}
    >
      {shortLeft(deadline, now)}
    </span>
  )
}
