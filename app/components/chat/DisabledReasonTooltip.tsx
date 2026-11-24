"use client"

import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/components/ui/tooltip'

/** Native disabled controls cannot receive focus; the wrapper exposes their explanation. */
export function DisabledReasonTooltip({ reason, label, children }: {
  reason?: string
  label: string
  children: ReactNode
}) {
  if (!reason) return <>{children}</>
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span role="group" aria-label={label} aria-disabled="true" tabIndex={0}
            className="inline-flex cursor-not-allowed rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring [&>*]:pointer-events-none">
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
