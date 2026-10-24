/*
  LoadingCity
  The "Loading your city" transition (motion spec §3). A dark skyline stands on
  the horizon and its windows switch on as the main page's data really loads:
  each finished step lights its share of the ~120 windows. The status line shows
  the first step still in flight; the progress bar is finished ÷ total steps.
  It stays at least 600 ms. When everything has loaded, the skyline sinks away
  (~700 ms) while the main page settles in underneath.

  Slow or failed loading: "Still loading…" after 4 s; a failed step shows
  "Couldn't load …" with Retry; an optional step that fails twice also offers
  "Continue without it". It never moves on with data that didn't load.

  Props:
    steps:    [{ key, label, thing, optional?, load: async () => data }] (lib/data.js)
    onReady:  function(results), called ~200 ms into the exit so App mounts underneath
    onExited: function(), called when the loader has fully gone

  Needs: shadcn button; lib/motion.js
*/
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ease, prefersReducedMotion } from "@/lib/motion"

const WINDOWS = 120
const MIN_SHOW = 600 // ms
const SLOW_AFTER = 4000 // ms
const VB_W = 1440
const VB_H = 340
const BASE = 330 // horizon y in the viewBox

// Small seeded random generator, so the city (and which windows light) never shuffles
function seeded(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// count buildings spread across the width; heights between min and max; some with a stepped top
function makeLayer(count, minH, maxH, seed) {
  const rand = seeded(seed)
  const slot = VB_W / count
  return Array.from({ length: count }, (_, i) => {
    const w = slot * (0.62 + rand() * 0.3)
    const x = i * slot + (slot - w) * rand()
    const h = minH + rand() * (maxH - minH)
    const step = rand() < 0.3 ? { w: w * (0.4 + rand() * 0.2), h: 18 + rand() * 22 } : null
    return { x, w, h, step }
  })
}

function layerPath(buildings) {
  return buildings
    .map(({ x, w, h, step }) => {
      const top = BASE - h
      if (!step) return `M${x} ${BASE} V${top} H${x + w} V${BASE} Z`
      const sx = x + (w - step.w) / 2
      return `M${x} ${BASE} V${top} H${sx} V${top - step.h} H${sx + step.w} V${top} H${x + w} V${BASE} Z`
    })
    .join(" ")
}

function layerEdge(buildings) {
  return buildings
    .map(({ x, w, h, step }) => {
      const top = BASE - h
      if (!step) return `M${x} ${top} H${x + w}`
      const sx = x + (w - step.w) / 2
      return `M${x} ${top} H${sx} V${top - step.h} H${sx + step.w} V${top} H${x + w}`
    })
    .join(" ")
}

const FAR = makeLayer(18, 90, 230, 7)
const NEAR = makeLayer(12, 120, 280, 21)

// A regular 4 × 6 window grid on the near buildings, trimmed to WINDOWS with a seeded pick
const ALL_WINDOWS = (() => {
  const rand = seeded(42)
  const list = []
  NEAR.forEach(({ x, w, h }) => {
    for (let wx = x + 10; wx + 4 <= x + w - 8; wx += 14) {
      for (let wy = BASE - h + 16; wy + 6 <= BASE - 14; wy += 18) list.push({ x: wx, y: wy })
    }
  })
  // Seeded shuffle: the order windows light in, and which ones are drawn at all
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list.slice(0, WINDOWS).map((w) => ({ ...w, teal: rand() < 0.15, delay: Math.round(rand() * 220) }))
})()

export function LoadingCity({ steps, onReady, onExited }) {
  const [state, setState] = useState(() => Object.fromEntries(steps.map((s) => [s.key, { status: "loading", fails: 0 }])))
  const [results, setResults] = useState({})
  const [finishedOrder, setFinishedOrder] = useState([]) // step keys, in the order they finished
  const [slow, setSlow] = useState(false)
  const [exiting, setExiting] = useState(false)
  const startedAt = useRef(0)
  const rootRef = useRef(null)

  const run = useCallback((step) => {
    setState((prev) => ({ ...prev, [step.key]: { ...prev[step.key], status: "loading" } }))
    step
      .load()
      .then((data) => {
        setResults((prev) => ({ ...prev, [step.key]: data }))
        setState((prev) => ({ ...prev, [step.key]: { ...prev[step.key], status: "done" } }))
        setFinishedOrder((prev) => (prev.includes(step.key) ? prev : [...prev, step.key]))
      })
      .catch((err) => {
        console.error(err)
        setState((prev) => ({ ...prev, [step.key]: { status: "error", fails: prev[step.key].fails + 1 } }))
      })
  }, [])

  // Start every request in parallel
  useEffect(() => {
    startedAt.current = performance.now()
    steps.forEach(run)
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER)
    return () => clearTimeout(timer)
  }, [steps, run])

  const skip = (step) => {
    setState((prev) => ({ ...prev, [step.key]: { ...prev[step.key], status: "skipped" } }))
    setFinishedOrder((prev) => [...prev, step.key])
  }

  const settled = steps.every((s) => ["done", "skipped"].includes(state[s.key].status))
  const current = steps.find((s) => state[s.key].status === "loading")
  const failed = steps.filter((s) => state[s.key].status === "error")
  const progress = finishedOrder.length / steps.length

  // Which windows are on: each finished step lights its own batch, and they never switch back off
  const lit = useMemo(() => {
    const per = Math.ceil(WINDOWS / steps.length)
    const on = new Set()
    finishedOrder.forEach((_, k) => {
      for (let i = k * per; i < Math.min(WINDOWS, (k + 1) * per); i++) on.add(i)
    })
    return on
  }, [finishedOrder, steps.length])

  // Latest values for the exit timers (they're scheduled once and must not be reset by re-renders)
  const latest = useRef({ results, onReady, onExited })
  useEffect(() => {
    latest.current = { results, onReady, onExited }
  })
  const exitScheduled = useRef(false)

  // Exit once everything has settled and at least 600 ms have passed
  useEffect(() => {
    if (!settled || exitScheduled.current) return
    exitScheduled.current = true
    const waitFor = Math.max(0, MIN_SHOW - (performance.now() - startedAt.current))
    setTimeout(() => {
      setExiting(true)
      if (prefersReducedMotion()) {
        // Reduced motion: a plain 200 ms cross-fade
        latest.current.onReady(latest.current.results)
        rootRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" })
        setTimeout(() => latest.current.onExited(), 200)
      } else {
        setTimeout(() => latest.current.onReady(latest.current.results), 200)
        setTimeout(() => latest.current.onExited(), 700)
      }
    }, waitFor)
  }, [settled])

  const sink = (delay) => ({
    transition: `transform 400ms ${ease.inOut} ${delay}ms, opacity 400ms ${ease.inOut} ${delay}ms`,
    transform: exiting ? "translateY(24px)" : "none",
    opacity: exiting ? 0 : 1,
  })

  return (
    <div
      ref={rootRef}
      className={`fixed inset-0 z-50 bg-background ${exiting ? "pointer-events-none" : ""}`}
      style={{
        // The same grid and glow as the main page, so nothing jumps when this fades
        backgroundImage:
          "radial-gradient(80% 45% at 50% -10%, rgba(79,201,180,0.13), transparent 70%), linear-gradient(rgba(188,201,190,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(188,201,190,0.045) 1px, transparent 1px)",
        backgroundSize: "100% 100vh, 56px 56px, 56px 56px",
        backgroundRepeat: "no-repeat, repeat, repeat",
        transition: `opacity 400ms ${ease.inOut} 120ms`,
        opacity: exiting ? 0 : 1,
      }}
    >
      {/* Label, status and progress */}
      <div
        className="absolute inset-x-0 top-[38%] flex flex-col items-center gap-3 px-5 text-center"
        style={{ transition: `opacity 200ms ${ease.exit}`, opacity: exiting ? 0 : 1 }}
      >
        <p className="font-code flex items-center gap-2.5 text-[13px] font-semibold tracking-[0.32em] text-muted-foreground">
          <span aria-hidden="true" className="size-[7px] rounded-full bg-teal" />
          LOADING YOUR CITY
        </p>
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-1 text-[15px] text-soft">
          <span>{current ? current.label : failed.length ? "" : "Ready."}</span>
          {slow && current && <span className="text-[13px] text-muted-foreground">Still loading…</span>}
          {failed.map((step) => (
            <span key={step.key} className="mt-1 flex flex-wrap items-center justify-center gap-2 text-[13px] text-destructive">
              Couldn't load {step.thing}.
              <Button variant="outline" size="sm" onClick={() => run(step)}>
                Retry
              </Button>
              {step.optional && state[step.key].fails >= 2 && (
                <Button variant="ghost" size="sm" onClick={() => skip(step)}>
                  Continue without it
                </Button>
              )}
            </span>
          ))}
        </div>
        <div className="mt-1 h-0.5 w-40 overflow-hidden bg-line-2" aria-hidden="true">
          <div
            className="h-full w-full origin-left bg-teal"
            style={{ transform: `scaleX(${progress})`, transition: `transform 240ms ${ease.out}` }}
          />
        </div>
      </div>

      {/* The skyline: far layer, near layer with its windows, horizon line */}
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-[38%] w-full"
      >
        <g style={sink(180)}>
          <path d={layerPath(FAR)} fill="#111714" />
          <path d={layerEdge(FAR)} fill="none" stroke="rgba(188,201,190,0.10)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </g>
        <g style={sink(120)}>
          <path d={layerPath(NEAR)} fill="#18201c" />
          <path d={layerEdge(NEAR)} fill="none" stroke="rgba(188,201,190,0.16)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {ALL_WINDOWS.map((w, i) => {
            const on = lit.has(i) || exiting
            return (
              <g key={i}>
                <rect x={w.x} y={w.y} width="4" height="6" fill="rgba(188,201,190,0.06)" />
                <rect
                  x={w.x}
                  y={w.y}
                  width="4"
                  height="6"
                  fill={w.teal ? "rgba(79,201,180,0.6)" : "rgba(243,239,230,0.55)"}
                  style={{
                    opacity: on ? 1 : 0,
                    // Remaining windows switch on together at the exit (120 ms)
                    transition: exiting ? "opacity 120ms ease-out" : `opacity 160ms ease-out ${w.delay}ms`,
                  }}
                />
              </g>
            )
          })}
        </g>
        <g style={sink(180)}>
          <line x1="0" y1={BASE} x2={VB_W} y2={BASE} stroke="url(#loader-horizon)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        </g>
        <defs>
          <linearGradient id="loader-horizon" x1="0" x2="1">
            <stop offset="0" stopColor="#4fc9b4" stopOpacity="0" />
            <stop offset=".5" stopColor="#4fc9b4" stopOpacity=".8" />
            <stop offset="1" stopColor="#4fc9b4" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
