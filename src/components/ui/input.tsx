import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-xl border border-border bg-white px-3.5 py-2 text-[13px] text-text-primary shadow-sm transition-all duration-150",
          "placeholder:text-text-disabled",
          "hover:border-border-strong",
          "focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/15",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-background-muted",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
