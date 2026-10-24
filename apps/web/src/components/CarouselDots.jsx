/*
  CarouselDots  (and useCarouselPosition)
  Bar-style indicators for a shadcn Carousel; the current slide is a longer bar.
  Click one to jump to that slide.
  useCarouselPosition(api) gives { selected, count } for labels like "1 of 4".

  Props:
    api:       the carousel API, from <Carousel setApi={setApi}>
    className: optional extra classes
    onClass:   optional colour for the active bar (default teal)
    offClass:  optional colour for the inactive bars (default faint bone)

  Needs: nothing else
*/
import { useEffect, useState } from "react"

export function useCarouselPosition(api) {
  const [selected, setSelected] = useState(0)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!api) return
    const update = () => {
      setCount(api.scrollSnapList().length)
      setSelected(api.selectedScrollSnap())
    }
    update()
    api.on("select", update)
    api.on("reInit", update)
    return () => {
      api.off("select", update)
      api.off("reInit", update)
    }
  }, [api])

  return { selected, count }
}

export function CarouselDots({ api, className = "", onClass = "bg-teal", offClass = "bg-[rgba(243,239,230,0.18)]" }) {
  const { selected, count } = useCarouselPosition(api)
  if (count <= 1) return null

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          aria-label={`Go to slide ${i + 1}`}
          onClick={() => api?.scrollTo(i)}
          className={`h-1.5 rounded-[1px] transition-[width,background-color] duration-[260ms] ease-[cubic-bezier(0.65,0,0.35,1)] ${
            i === selected ? `w-[22px] ${onClass}` : `w-1.5 ${offClass} hover:bg-muted-foreground`
          }`}
        />
      ))}
    </div>
  )
}
