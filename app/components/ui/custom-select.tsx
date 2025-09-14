"use client"

import { forwardRef } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "@/app/components/ui/icons"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  containerClassName?: string
  icon?: React.ReactNode
}

const CustomSelect = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, containerClassName, icon, children, ...props }, ref) => {
    return (
      <div className={cn("relative", containerClassName)}>
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none">
            {icon}
          </div>
        )}
        <select
          className={cn(
            "h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            icon && "pl-10 pr-8",
            !icon && "pr-8",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>
    )
  }
)
CustomSelect.displayName = "CustomSelect"

export interface OptionProps extends React.OptionHTMLAttributes<HTMLOptionElement> {}

const Option = forwardRef<HTMLOptionElement, OptionProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <option
        className={cn("py-1.5 px-2 text-sm", className)}
        ref={ref}
        {...props}
      >
        {children}
      </option>
    )
  }
)
Option.displayName = "Option"

export { CustomSelect, Option } 