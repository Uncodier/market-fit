"use client"

import * as React from "react"
import { Button, type ButtonProps } from "./button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

interface ToolbarIconButtonProps extends Omit<ButtonProps, "size" | "asChild"> {
  label: string
}

export const ToolbarIconButton = React.forwardRef<HTMLButtonElement, ToolbarIconButtonProps>(
  ({ label, children, disabled, variant = "ghost", type = "button", ...props }, ref) => (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0" tabIndex={disabled ? 0 : undefined} aria-label={disabled ? label : undefined}>
            <Button {...props} ref={ref} type={type} variant={variant} size="icon" disabled={disabled} aria-label={label} data-toolbar-icon-action="off">
              {children}
              <span className="sr-only">{label}</span>
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
)
ToolbarIconButton.displayName = "ToolbarIconButton"