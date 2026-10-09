"use client"

import { useState, type ReactNode } from "react"
import { HelpCircle } from "../ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"

export function BillingHelpTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            onClick={event => { event.preventDefault(); setOpen(true) }}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <HelpCircle className="h-4 w-4" aria-hidden={true} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" sideOffset={8}
          className="max-h-[60vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto p-3 text-sm font-normal leading-relaxed">
          <div className="space-y-2">{children}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}