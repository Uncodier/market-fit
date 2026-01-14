import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode
  iconPosition?: "left" | "right"
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, icon, iconPosition = "left", ...props }, ref) => {
    if (icon) {
      const iconElement = React.isValidElement(icon)
        ? React.cloneElement(icon as React.ReactElement, {
            className: cn("h-4 w-4 text-muted-foreground", (icon as React.ReactElement).props?.className)
          })
        : icon

      return (
        <div className="relative w-full">
          {iconPosition === "left" && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none z-10">
              {iconElement}
            </div>
          )}
          <input
            className={cn(
              "flex h-11 w-full rounded-md border border-input bg-background text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              iconPosition === "left" ? "pl-9 pr-2.5" : "pl-2.5 pr-9",
              className
            )}
            ref={ref}
            {...props}
          />
          {iconPosition === "right" && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none z-10">
              {iconElement}
            </div>
          )}
        </div>
      )
    }

    return (
      <input
        className={cn(
          "flex h-11 w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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