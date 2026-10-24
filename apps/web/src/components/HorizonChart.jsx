/*
  HorizonChart
  A small chart of the next 6 days: a baseline from NOW to +6D with an orange
  beacon for each open deadline, placed by time left. The nearer a deadline,
  the taller its beacon; the nearest gets a thicker stem and a halo.
  Deadlines more than 6 days away aren't plotted (they're still in the list).
  It draws at the panel's real width, so dots stay round and labels don't
  stretch; a label that would overlap the one before it is left off.

  Props:
    deadlines: open deadline items, nearest first
    now:       current time in ms (from useNow)

  Needs: src/lib/time.js
*/
import { useEffect, useRef, useState } from "react"
import { hoursUntil, shortLeft } from "@/lib/time"

const H = 96 // chart height
const BASE = 70 // baseline y
const SPAN = 144 // hours shown (6 days)
const CHAR = 5.6 // rough width of one 9px mono character, for spacing labels

export function HorizonChart({ deadlines, now }) {
  const ref = useRef(null)
  const [width, setWidth] = useState(260)

  // Follow the panel's width
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const xFor = (hours) => 14 + (hours / SPAN) * (width - 28)
  const shown = deadlines.filter((d) => hoursUntil(d.deadline_at, now) <= SPAN)
  const label = shown.length
    ? `Deadlines placed by time left: ${shown.map((d) => shortLeft(d.deadline_at, now)).join(", ")}`
    : "No deadlines in the next 6 days"

  // Work out each beacon, and skip labels that would run into the previous one
  const beacons = []
  let lastLabelEnd = -Infinity
  for (const [i, d] of shown.entries()) {
    const hours = Math.max(0, hoursUntil(d.deadline_at, now))
    const x = xFor(hours)
    const text = shortLeft(d.deadline_at, now)
    const showLabel = x + 7 > lastLabelEnd + 4
    if (showLabel) lastLabelEnd = x + 7 + text.length * CHAR
    beacons.push({
      id: d.id,
      x,
      top: BASE - Math.min(46, Math.max(14, 46 - hours / 4)),
      text: showLabel ? text : null,
      nearest: i === 0,
    })
  }

  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className="-mx-1 mt-0.5 h-24 overflow-hidden rounded-xl bg-[linear-gradient(180deg,rgba(9,13,11,0.2),rgba(242,138,60,0.06))]"
    >
      <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} aria-hidden="true" className="block">
        <defs>
          <linearGradient id="horizon-base" x1="0" x2="1">
            <stop offset="0" stopColor="#f28a3c" />
            <stop offset=".25" stopColor="#f3efe6" stopOpacity=".7" />
            <stop offset="1" stopColor="#4fc9b4" stopOpacity=".25" />
          </linearGradient>
        </defs>

        {Array.from({ length: 7 }, (_, day) => {
          const x = xFor(day * 24)
          return (
            <g key={day}>
              <line x1={x} y1={BASE} x2={x} y2={BASE + 5} stroke="#8e9a91" strokeOpacity=".5" />
              <text x={x} y="87" fill="#8e9a91" fontFamily="Geist Mono, monospace" fontSize="8" textAnchor="middle">
                {day === 0 ? "NOW" : `+${day}D`}
              </text>
            </g>
          )
        })}
        <line x1="6" y1={BASE} x2={width - 6} y2={BASE} stroke="url(#horizon-base)" strokeWidth="1.5" />

        {beacons.map((b) => (
          <g key={b.id}>
            <line
              x1={b.x}
              y1={BASE}
              x2={b.x}
              y2={b.top}
              stroke="#f28a3c"
              strokeOpacity={b.nearest ? 0.7 : 0.525}
              strokeWidth={b.nearest ? 2 : 1.5}
            />
            {b.nearest && <circle cx={b.x} cy={b.top} r="10" fill="#f28a3c" fillOpacity=".15" />}
            <circle cx={b.x} cy={b.top} r={b.nearest ? 4 : 3} fill="#f28a3c" fillOpacity={b.nearest ? 1 : 0.75} />
            {b.text && (
              <text
                x={b.x + 7}
                y={b.top + 3}
                fill="#f28a3c"
                fillOpacity={b.nearest ? 1 : 0.75}
                fontFamily="Geist Mono, monospace"
                fontSize="9"
                fontWeight="600"
              >
                {b.text}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  )
}
