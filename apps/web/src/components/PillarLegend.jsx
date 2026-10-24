/*
  PillarLegend
  The key above the calendar: "(E) Events  (O) Opportunities  (A) Announcements  (D) Deadlines"

  Props: none

  Needs: PillarBadge.jsx (PillarDot); src/lib/pillars.js
*/
import { PillarDot } from "@/components/PillarBadge"
import { PILLARS, pillarStyle } from "@/lib/pillars"

export function PillarLegend() {
  return (
    <div aria-label="Lines" className="flex flex-wrap items-center gap-3.5 text-[13px] text-soft">
      {PILLARS.map((p) => (
        <span key={p} className="flex items-center gap-1.5">
          <PillarDot pillar={p} />
          {pillarStyle[p].plural}
        </span>
      ))}
    </div>
  )
}
