/*
  LandingPage
  The "Welcome to your city" landing / sign-in scene (landing spec, motion spec §2).
  Layers, back to front: drifting glows, a flat grid, a line-drawn skyline with a
  teal rooftop network, the running horizon floor, then the wordmark, title,
  an EXAMPLE SIGNAL card (first visit only) and the sign-in card.

  First visit: a ~4.7 s intro plays (Skip intro or Esc jumps to the end) and
  localStorage "unmute:introSeen:v1" is set when it ends. Returning visitors
  (or anyone whose storage can't be read) get the finished scene straight away.
  Reduced motion always gets the finished scene, with the floor and glows still.

  Props:
    onSignIn:   async function(), the real sign-in call (see lib/auth.js)
    onSignedIn: function(), called after sign-in succeeds and the scene has faded

  Needs: SignIn.jsx, Logo.jsx; lib/landingCity.js, lib/motion.js; styles/landing.css
*/
import { useCallback, useEffect, useRef, useState } from "react"
import { Logo } from "@/components/Logo"
import { SignIn } from "@/components/SignIn"
import { BUILDINGS, EDGES, SIGNAL_ROUTE, buildingPath, roofPoint } from "@/lib/landingCity"
import { storage, useReducedMotion } from "@/lib/motion"
import "@/styles/landing.css"

const INTRO_KEY = "unmute:introSeen:v1"
const INTRO_END = 4500 // ms: the sign-in card has finished rising in
const NODES = [...new Set(EDGES.flat())]

const COPY = {
  first: { line1: "Welcome to", line2: "your city", lead: "A world of information.", em: "A clearer way through it." },
  returning: { line1: "Welcome back", line2: "to your city", lead: "Mute the groups,", em: "not the opportunities." },
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

// The skyline, drawn at its real pixel size so lines stay 1px
function Skyline({ playing }) {
  const svgRef = useRef(null)
  const dotRef = useRef(null)
  const haloRef = useRef(null)
  const [size, setSize] = useState({ w: 1440, h: 240 })

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width && height) setSize({ w: width, h: height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const sx = size.w / 1440
  const sy = size.h / 240

  // The orange signal travelling across the rooftops (2400–3500 ms), then
  // resolving into the example card (3500–3950 ms). One rAF loop, intro only.
  useEffect(() => {
    if (!playing) return
    const dot = dotRef.current
    const halo = haloRef.current
    const route = SIGNAL_ROUTE.map((i) => roofPoint(i, sx, sy))
    const legs = route.slice(1).map((p, k) => Math.hypot(p[0] - route[k][0], p[1] - route[k][1]))
    const total = legs.reduce((a, b) => a + b, 0)

    const pointAt = (t) => {
      let d = t * total
      for (let k = 0; k < legs.length; k++) {
        if (d <= legs[k] || k === legs.length - 1) {
          const f = legs[k] ? Math.min(1, d / legs[k]) : 0
          return [route[k][0] + (route[k + 1][0] - route[k][0]) * f, route[k][1] + (route[k + 1][1] - route[k][1]) * f]
        }
        d -= legs[k]
      }
      return route[route.length - 1]
    }

    const start = performance.now()
    let frame
    const tick = (now) => {
      const t = now - start
      if (t >= 2400 && t < 3500) {
        const [x, y] = pointAt(easeInOutCubic((t - 2400) / 1100))
        for (const el of [dot, halo]) {
          el.setAttribute("cx", x)
          el.setAttribute("cy", y)
          el.style.opacity = "1"
        }
        halo.setAttribute("r", 12)
      } else if (t >= 3500 && t < 3950) {
        const f = (t - 3500) / 450
        halo.setAttribute("r", 12 + 18 * f)
        halo.style.opacity = String(1 - f)
        dot.style.opacity = String(1 - f)
      } else if (t >= 3950) {
        dot.style.opacity = "0"
        halo.style.opacity = "0"
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      dot.style.opacity = ""
      halo.style.opacity = ""
    }
    // Only restart with the intro, not on every resize
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing])

  return (
    <svg ref={svgRef} className="skyline" aria-hidden="true">
      {BUILDINGS.map((_, i) => (
        <path key={i} className="bld" d={buildingPath(i, sx, sy)} pathLength="1" style={{ "--d": `${600 + i * 45}ms` }} />
      ))}
      {EDGES.map(([a, b], k) => {
        const [x1, y1] = roofPoint(a, sx, sy)
        const [x2, y2] = roofPoint(b, sx, sy)
        return (
          <path key={k} className="edge" d={`M${x1} ${y1} L${x2} ${y2}`} pathLength="1" style={{ "--d": `${1500 + k * 40}ms` }} />
        )
      })}
      {NODES.map((i, k) => {
        const [cx, cy] = roofPoint(i, sx, sy)
        return <circle key={i} className="node" cx={cx} cy={cy} r="2.5" style={{ "--d": `${1500 + k * 40}ms` }} />
      })}
      <circle ref={haloRef} className="signal-halo" r="12" />
      <circle ref={dotRef} className="signal" r="4.5" />
    </svg>
  )
}

export function LandingPage({ onSignIn, onSignedIn }) {
  const reduced = useReducedMotion()
  // Storage that can't be read counts as "seen", so nobody is stuck replaying the intro
  const [firstVisit] = useState(() => storage.get(INTRO_KEY, "1") !== "1")
  const [playing, setPlaying] = useState(() => firstVisit && !reduced)
  const [paused, setPaused] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const titleRef = useRef(null)
  const copy = firstVisit ? COPY.first : COPY.returning

  const finishIntro = useCallback(() => {
    setPlaying(false)
    storage.set(INTRO_KEY, "1")
    titleRef.current?.focus()
  }, [])

  // The intro ends on its own at 4.5 s; Esc skips it
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(finishIntro, INTRO_END)
    const onKey = (e) => e.key === "Escape" && finishIntro()
    window.addEventListener("keydown", onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("keydown", onKey)
    }
  }, [playing, finishIntro])

  // A first visit under reduced motion sees the finished scene, which counts as seen
  useEffect(() => {
    if (firstVisit && reduced) storage.set(INTRO_KEY, "1")
  }, [firstVisit, reduced])

  // The floor and glows pause while the tab is hidden
  useEffect(() => {
    const onVisibility = () => setPaused(document.visibilityState === "hidden")
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  async function handleSignIn() {
    await onSignIn() // throws on failure; the card shows the error
    if (playing) finishIntro()
    setLeaving(true)
    await wait(reduced ? 0 : 200) // title, card and skyline fade out
    onSignedIn()
  }

  const classes = ["landing", playing && "is-intro", paused && "is-paused", leaving && "is-leaving"].filter(Boolean).join(" ")

  return (
    <main className={classes}>
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
      </div>
      <div className="flat-grid" aria-hidden="true" />
      <Skyline playing={playing} />
      <div className="horizon" aria-hidden="true">
        <div className="horizon-glow" />
        <div className="horizon-plane" />
        <div className="horizon-line" />
      </div>

      <div className="topbar">
        {playing && (
          <button type="button" className="skip order-last" onClick={finishIntro}>
            Skip intro
          </button>
        )}
        <span className="wordmark">
          <Logo />
        </span>
      </div>

      <div className="hero">
        <span className="kicker">UNMUTE</span>
        <h1 ref={titleRef} tabIndex={-1} className="title">
          <span className="title-1">{copy.line1}</span>
          <span className="title-2">{copy.line2}</span>
          <span className="beam-track" aria-hidden="true">
            <span className="beam" />
          </span>
        </h1>
        <p className="tagline">
          {copy.lead} <em>{copy.em}</em>
        </p>
      </div>

      {firstVisit && (
        <div className="slot slot-example">
          <div className="example" role="note" aria-label="Example signal">
            <p className="font-code flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] text-signal">
              <span aria-hidden="true" className="size-[7px] rounded-full bg-signal shadow-[0_0_8px_rgba(242,138,60,0.7)]" />
              EXAMPLE SIGNAL
            </p>
            <p className="mt-2 text-[17px] font-semibold">Gen AI workshop · Sat 2:00 PM</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Registration closes Fri, 11:59 PM · AI Club · Seminar Hall 2
            </p>
          </div>
        </div>
      )}

      <div className={`slot slot-signin ${firstVisit ? "" : "is-returning"}`}>
        <SignIn onSignIn={handleSignIn} />
      </div>
    </main>
  )
}
