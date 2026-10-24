/*
  AroundCampus: "New on the block" (eyebrow AROUND CAMPUS)
  One big full-width carousel of campus items OUTSIDE the student's interests,
  so they don't live in a filter bubble. Forest-green panel with a static
  perspective floor; each slide has the line badge, a huge condensed title, a
  short description, "Apply by 30 Oct · from Dept notices", "Add to my week" +
  "View details". Orange bar indicators and "1 / 5" at the bottom.
  Arrows sit at the top right, next to the heading. (No posters, on purpose.)

  Props:
    items:     all items
    interests: the student's interests (items matching these are left out)
    addedIds:  ids already in the student's week
    onToggle:  function(id, buttonEl), adds the item to the week, or removes it if already added
    onOpen:    function(item)

  Needs: shadcn carousel, button; PillarBadge.jsx; CarouselDots.jsx; date-fns
*/
import { useState } from "react"
import { format } from "date-fns"
import { Check, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { CarouselDots, useCarouselPosition } from "@/components/CarouselDots"
import { PillarBadge } from "@/components/PillarBadge"

function metaLine(item) {
  const d = (iso) => format(new Date(iso), "d MMM")
  let when = ""
  if (item.deadline_at) {
    const verb = { opportunity: "Apply by", event: "Register by", deadline: "Closes" }[item.pillar] ?? "Until"
    when = `${verb} ${d(item.deadline_at)}`
  } else if (item.starts_at) {
    when = format(new Date(item.starts_at), "EEE d MMM, h:mm a")
  }
  return [when, `from ${item.source_group}`].filter(Boolean).join(" · ")
}

export function AroundCampus({ items, interests, addedIds, onToggle, onOpen }) {
  const [api, setApi] = useState(null)
  const { selected, count } = useCarouselPosition(api)
  const others = items.filter((i) => !i.interests.some((x) => interests.includes(x)))

  if (others.length === 0) return null

  return (
    <Carousel
      setApi={setApi}
      opts={{ align: "start", loop: true }}
      id="city"
      aria-labelledby="up-h"
      className="flex scroll-mt-24 flex-col gap-5 pt-[72px]"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Around campus</span>
          <h2 id="up-h" className="mt-2.5 text-5xl leading-[0.92] lg:text-[64px]">New on the block</h2>
          <p className="mt-2.5 text-sm text-muted-foreground">From across the city, outside your interests</p>
        </div>
        <div className="flex gap-1.5">
          <CarouselPrevious size="icon" className="static translate-y-0 rounded-lg" />
          <CarouselNext size="icon" className="static translate-y-0 rounded-lg" />
        </div>
      </div>

      {/* One forest panel; the slides move inside it */}
      <div className="relative overflow-hidden rounded-3xl border border-[rgba(79,201,180,0.25)] bg-[radial-gradient(110%_120%_at_80%_0%,#24503f_0%,#1b3d31_38%,#0b1712_100%)]">
        <div aria-hidden="true" className="floor floor-featured" />
        <CarouselContent className="ml-0">
          {others.map((item) => {
            const isAdded = addedIds.includes(item.id)
            return (
              <CarouselItem key={item.id} className="basis-full pl-0">
                <div className="relative flex min-h-[340px] flex-col gap-4 p-7 sm:px-14 sm:pt-14 sm:pb-10">
                  <PillarBadge pillar={item.pillar} />
                  <h3 className="max-w-[860px] text-[44px] leading-[0.92] font-black md:text-[58px] lg:text-[72px]">
                    {item.title}
                  </h3>
                  {item.description && <p className="max-w-[680px] text-[17px] leading-normal text-soft">{item.description}</p>}
                  <p className="text-sm text-[#a9bfb2]">{metaLine(item)}</p>
                  <div className="mt-1 flex flex-wrap gap-2.5">
                    <Button variant={isAdded ? "done" : "default"} aria-pressed={isAdded} className="active:scale-[0.98]" onClick={(e) => onToggle(item.id, e.currentTarget)}>
                      {isAdded ? <Check className="size-4" /> : <Plus className="size-4" />}
                      {isAdded ? "Added to your week" : "Add to my week"}
                    </Button>
                    <Button variant="outline" onClick={() => onOpen(item)}>
                      View details
                    </Button>
                  </div>
                </div>
              </CarouselItem>
            )
          })}
        </CarouselContent>

        <div className="relative flex items-center gap-3.5 px-7 pb-8 sm:px-14">
          <CarouselDots api={api} onClass="bg-signal" offClass="bg-[rgba(243,239,230,0.25)]" />
          <span className="font-code text-xs text-[#a9bfb2]">
            {(count ? selected : 0) + 1} / {count || others.length}
          </span>
        </div>
      </div>
    </Carousel>
  )
}
