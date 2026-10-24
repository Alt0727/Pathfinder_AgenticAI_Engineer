import * as React from "react"
import { cn } from "cn"

function Input({
  className,
  type,
  ...props
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-xl border border-line-2 bg-deep px-3 py-1 text-[13px] text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-[#7a877f] focus-visible:border-teal focus-visible:shadow-[0_0_0_3px_rgba(79,201,180,0.12)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }
