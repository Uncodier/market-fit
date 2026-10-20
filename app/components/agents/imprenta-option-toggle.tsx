"use client"

import type { ReactNode } from "react"

import { Button } from "@/app/components/ui/button"
import { Check } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/app/components/ui/tooltip"

type ImprentaOptionToggleProps = {
  label: string
  icon: ReactNode
  hint: string
  selected: boolean
  onToggle: () => void | Promise<void>
}

export function ImprentaOptionToggle({
  label,
  icon,
  hint,
  selected,
  onToggle,
}: ImprentaOptionToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={label}
          aria-pressed={selected}
          data-state={selected ? "on" : "off"}
          className={`h-8 w-full min-w-0 justify-start gap-2 rounded-md px-2.5 text-left text-[11px] ${
            selected
              ? "bg-secondary text-foreground ring-1 ring-inset ring-foreground/20"
              : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
          }`}
          onClick={(event) => {
            event.stopPropagation()
            onToggle()
          }}
        >
          <span aria-hidden="true" className="flex h-3 w-3 shrink-0 items-center justify-center [&>div]:h-full [&>div]:w-full [&>span]:h-full [&>span]:w-full [&>svg]:h-full [&>svg]:w-full">
            {icon}
          </span>
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <span aria-hidden="true" className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
            {selected && <Check size={14} />}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-[11px]">
        {hint}
      </TooltipContent>
    </Tooltip>
  )
}