/*
  PillarBadge  (and PillarDot)
  PillarDot:   the small letter circle (E / O / A / D) in the pillar's colour.
  PillarBadge: an outlined pill with the dot and the label, e.g. (E) Event.
  Always shows a letter or text, never colour alone.

  Props:
    pillar:    "event" | "opportunity" | "announcement" | "deadline"
    className: optional extra Tailwind classes
    label:     (PillarBadge only) optional text instead of the default label

  Needs: src/lib/pillars.js, src/lib/utils.js (cn)
  Example: <PillarBadge pillar="event" />   <PillarDot pillar="deadline" />
*/
import { cn } from "@/lib/utils"
import { pillarStyle } from "@/lib/pillars"

export function PillarDot({ pillar, className }) {
  const style = pillarStyle[pillar] ?? pillarStyle.announcement
  return (
    <span
      aria-hidden="true"
      className={cn(
        "font-code inline-flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none",
        style.dot,
        className,
      )}
    >
      {style.letter}
    </span>
  )
}

export function PillarBadge({ pillar, className, label }) {
  const style = pillarStyle[pillar] ?? pillarStyle.announcement
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-[7px] rounded-full border-[1.5px] bg-[rgba(9,13,11,0.5)] py-0.5 pr-3 pl-0.5 text-xs font-semibold whitespace-nowrap text-foreground",
        style.badge,
        className,
      )}
    >
      <PillarDot pillar={pillar} className="size-5 text-[11px]" />
      {label ?? style.label}
    </span>
  )
}
