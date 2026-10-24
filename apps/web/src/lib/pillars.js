/*
  pillars.js
  Colours, labels and letter roundels for the four "lines" (pillars), from the UI spec:
    Events = teal (E) · Opportunities = wine (O) · Announcements = sage (A) · Deadlines = orange (D)
  Every component reads from here, so a colour only ever changes in one place.

  Class names are written out in full on purpose: Tailwind only includes classes
  it can see spelled out completely in the code.
*/

export const PILLARS = ["event", "opportunity", "announcement", "deadline"]

export const pillarStyle = {
  event: {
    label: "Event",
    plural: "Events",
    letter: "E",
    dot: "bg-line-e text-line-e-ink", // letter roundel
    badge: "border-line-e", // outlined pill
    tile: "border-l-line-e bg-[rgba(79,201,180,0.07)]", // calendar entry
    panel: "bg-[#1b3d31]", // item card left panel
  },
  opportunity: {
    label: "Opportunity",
    plural: "Opportunities",
    letter: "O",
    dot: "bg-line-o text-line-o-ink",
    badge: "border-line-o",
    tile: "border-l-line-o bg-[rgba(168,72,84,0.10)]",
    panel: "bg-[#4a1c22]",
  },
  announcement: {
    label: "Announcement",
    plural: "Announcements",
    letter: "A",
    dot: "bg-line-a text-line-a-ink",
    badge: "border-line-a",
    tile: "border-l-line-a bg-[rgba(188,201,190,0.06)]",
    panel: "bg-[#2c302c]",
  },
  deadline: {
    label: "Deadline",
    plural: "Deadlines",
    letter: "D",
    dot: "bg-line-d text-line-d-ink",
    badge: "border-line-d",
    tile: "border-l-line-d bg-signal-soft",
    panel: "bg-[#7a3a12]",
  },
}

// Shared look for the big bordered panels (buildings, your week, signals…)
export const panelClass = "relative rounded-2xl border bg-surface/92"

// Only real places get a place line, never "Online" or "Shared drive"
export function isPhysicalPlace(venue) {
  return Boolean(venue) && !/online|drive/i.test(venue)
}
