/*
  motion.js
  Timing tokens and small helpers for unmute's motion (see the motion spec).
  Standard entrance: opacity 0 → 1 and y 8px → 0, never more than 12px.
  No springs, bounce or blur on text. Only opacity and transform are animated.
*/
import { useSyncExternalStore } from "react"

// Durations in seconds (spec values) and in ms for the Web Animations API
export const dur = { press: 0.12, small: 0.22, content: 0.24, add: 0.32 }
export const ms = { press: 120, small: 220, content: 240, add: 320 }

// Easing curves, as CSS strings
export const ease = {
  out: "cubic-bezier(0.22, 1, 0.36, 1)", // entering
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)", // moving between related states
  exit: "cubic-bezier(0.4, 0, 1, 1)", // leaving
}

const QUERY = "(prefers-reduced-motion: reduce)"

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.(QUERY).matches
}

// React hook: true while the visitor has asked for reduced motion
export function useReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia?.(QUERY)
      mq?.addEventListener("change", onChange)
      return () => mq?.removeEventListener("change", onChange)
    },
    prefersReducedMotion,
    () => false,
  )
}

// localStorage that never throws (private windows, blocked storage).
// get() returns `fallback` when storage can't be read at all.
export const storage = {
  get(key, fallback = null) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return fallback
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
}

/*
  "Add to my week" flight: a 200 × 36 chip with the item's roundel and title
  flies from the button to the target day column (320 ms, in-out), then is removed.
  Does nothing under reduced motion or if either element is missing.
*/
export function flyChip(fromEl, toEl, { title, letter, roundelClass }) {
  if (!fromEl || !toEl || prefersReducedMotion()) return
  const from = fromEl.getBoundingClientRect()
  const to = toEl.getBoundingClientRect()

  const chip = document.createElement("div")
  chip.setAttribute("aria-hidden", "true")
  chip.className =
    "pointer-events-none fixed z-[60] flex h-9 w-[200px] items-center gap-2 rounded-lg border border-line-2 bg-surface-2 px-2 text-[13px] font-medium text-foreground shadow-[0_12px_30px_rgba(0,0,0,0.45)]"
  const dot = document.createElement("span")
  dot.className = `font-code inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${roundelClass}`
  dot.textContent = letter
  const label = document.createElement("span")
  label.className = "truncate"
  label.textContent = title
  chip.append(dot, label)

  const startX = from.left + from.width / 2 - 100
  const startY = from.top + from.height / 2 - 18
  const endX = to.left + to.width / 2 - 100
  const endY = to.top + 24
  chip.style.left = "0px"
  chip.style.top = "0px"
  document.body.appendChild(chip)

  const animation = chip.animate(
    [
      { transform: `translate(${startX}px, ${startY}px) scale(1)`, opacity: 1 },
      { transform: `translate(${endX}px, ${endY}px) scale(0.6)`, opacity: 0.2 },
    ],
    { duration: ms.add, easing: ease.inOut, fill: "forwards" },
  )
  animation.onfinish = () => chip.remove()
  animation.oncancel = () => chip.remove()
}
