import * as React from "react"
import { cva } from "class-variance-authority";
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // unmute primary: sage
        default: "bg-sage font-semibold text-sage-ink hover:bg-sage-hover",
        // unmute secondary: transparent with a light outline
        outline:
          "border-line-2 bg-transparent text-foreground hover:bg-[rgba(243,239,230,0.06)] aria-expanded:bg-[rgba(243,239,230,0.06)]",
        secondary: "bg-surface-2 text-foreground hover:bg-[rgba(243,239,230,0.08)]",
        ghost: "text-foreground hover:bg-[rgba(243,239,230,0.06)] aria-expanded:bg-[rgba(243,239,230,0.06)]",
        // orange, only for "Open form" in the live bar
        signal: "bg-signal font-semibold text-signal-ink hover:bg-[#f69b55]",
        // "Added to your week"
        done: "border-sage bg-transparent font-semibold text-sage hover:bg-[rgba(243,239,230,0.06)]",
        destructive: "bg-[rgba(240,180,168,0.08)] text-destructive hover:bg-[rgba(240,180,168,0.14)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 gap-2 px-4",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-[34px] gap-1.5 px-3 text-[13px]",
        lg: "h-11 gap-2 px-[18px]",
        icon: "size-9",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
