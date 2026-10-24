/*
  InterestCarousels
  "Your network" (eyebrow FOR YOUR INTERESTS): one panel per interest, side by side.
  Panel header "AI & ML · 1 of 4" with "via AI Club, Coding club" and ‹ › arrows;
  one ItemCard at a time; bar indicators underneath. ← / → work when focused.

  Props:
    items:     all items
    interests: the student's interests, e.g. ["AI & ML", "Design", "Placements"]
    addedIds:  ids already in the student's week
    onToggle:  function(id, buttonEl), adds the item to the week, or removes it if already added
    onOpen:    function(item)

  Needs: shadcn carousel; ItemCard.jsx; CarouselDots.jsx; src/lib/pillars.js (panelClass)
*/
import { useState } from "react"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { CarouselDots, useCarouselPosition } from "@/components/CarouselDots"
import { ItemCard } from "@/components/ItemCard"
import { panelClass } from "@/lib/pillars"

const arrowClass = "static size-9 translate-y-0 rounded-lg"

// "Placement Cell · Official" -> "Placement Cell", "AI Club group" -> "AI Club"
const shortSource = (name) => name.replace(" · Official", "").replace(/ group$/, "")

// The tiny network glyph before "via …"
function ViaGlyph() {
  return (
    <svg width="34" height="16" viewBox="0 0 34 16" aria-hidden="true" className="shrink-0">
      <line x1="5" y1="8" x2="17" y2="3" stroke="#4fc9b4" strokeOpacity=".6" />
      <line x1="5" y1="8" x2="17" y2="13" stroke="#4fc9b4" strokeOpacity=".6" />
      <line x1="17" y1="3" x2="29" y2="8" stroke="#4fc9b4" strokeOpacity=".35" />
      <line x1="17" y1="13" x2="29" y2="8" stroke="#4fc9b4" strokeOpacity=".35" />
      <circle cx="5" cy="8" r="3" fill="#f3efe6" />
      <circle cx="17" cy="3" r="2.2" fill="#4fc9b4" />
      <circle cx="17" cy="13" r="2.2" fill="#4fc9b4" />
      <circle cx="29" cy="8" r="2" fill="#4fc9b4" fillOpacity=".5" />
    </svg>
  )
}

export function InterestCarousels({ items, interests, addedIds, onToggle, onOpen }) {
  return (
    <section id="network" aria-labelledby="int-h" className="flex scroll-mt-24 flex-col gap-5 pt-[72px]">
      <div>
        <span className="eyebrow">For your interests</span>
        <h2 id="int-h" className="mt-2.5 text-5xl leading-[0.92] lg:text-[64px]">Your network</h2>
        <p className="mt-2.5 text-sm text-muted-foreground">
          Picked from your groups, based on what you follow and what you add
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {interests.map((interest) => (
          <InterestPanel
            key={interest}
            interest={interest}
            items={items.filter((i) => i.interests.includes(interest))}
            addedIds={addedIds}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  )
}

function InterestPanel({ interest, items, addedIds, onToggle, onOpen }) {
  const [api, setApi] = useState(null)
  const { selected, count } = useCarouselPosition(api)
  const via = [...new Set(items.map((i) => shortSource(i.source_group)))].slice(0, 2).join(", ")

  if (items.length === 0) {
    return (
      <div className={`flex flex-col gap-3.5 p-[18px] ${panelClass}`}>
        <h3 className="text-[30px] leading-[1.05]">{interest}</h3>
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nothing new for {interest} yet.
        </p>
      </div>
    )
  }

  return (
    <Carousel setApi={setApi} opts={{ align: "start" }} className={`flex min-w-0 flex-col gap-3.5 p-[18px] ${panelClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[30px] leading-[1.05]">
            {interest}
            <span className="font-sans text-[13px] font-normal tracking-normal text-muted-foreground normal-case">
              {" "}
              · {count ? selected + 1 : 1} of {count || items.length}
            </span>
          </h3>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <ViaGlyph />
            via {via}
          </p>
        </div>
        <div className="flex gap-1.5">
          <CarouselPrevious size="icon" className={arrowClass} />
          <CarouselNext size="icon" className={arrowClass} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl">
        <CarouselContent className="ml-0">
          {items.map((item) => (
            <CarouselItem key={item.id} className="basis-full px-px">
              <ItemCard item={item} isAdded={addedIds.includes(item.id)} onToggle={onToggle} onOpen={onOpen} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </div>

      <CarouselDots api={api} className="justify-center" />
    </Carousel>
  )
}
