"use client"

import { Badge } from "@/app/components/ui/badge"
import { Check } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

export type ProgressiveStatusBarProps<T extends string> = {
  current: T
  forwardPath: readonly T[]
  outcomes?: readonly T[]
  successOutcomes?: readonly T[]
  styles: Record<T, string>
  labels: Record<T, string> | ((status: T) => string)
  onChange: (status: T) => void
  disabled?: boolean
  disabledStatuses?: readonly T[]
  className?: string
}

function labelFor<T extends string>(
  labels: Record<T, string> | ((status: T) => string),
  status: T
) {
  return typeof labels === "function" ? labels(status) : labels[status]
}

export function ProgressiveStatusBar<T extends string>({
  current,
  forwardPath,
  outcomes = [],
  successOutcomes = [],
  styles,
  labels,
  onChange,
  disabled,
  disabledStatuses = [],
  className,
}: ProgressiveStatusBarProps<T>) {
  const currentIndex = forwardPath.indexOf(current)
  const isOutcome = outcomes.includes(current)
  const isSuccessOutcome = successOutcomes.includes(current)

  const isDisabledStatus = (status: T) =>
    Boolean(disabled || (disabledStatuses.includes(status) && current !== status))

  const select = (status: T) => {
    if (isDisabledStatus(status) || status === current) return
    onChange(status)
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex items-center">
        {forwardPath.map((status, index) => {
          const isCurrent = current === status
          const isPast = isSuccessOutcome || (!isOutcome && currentIndex > index)
          const itemDisabled = isDisabledStatus(status)
          return (
            <div key={status} className="flex items-center">
              {index > 0 && (
                <div
                  className={cn("w-3 h-px mx-0.5", isPast || isCurrent ? "bg-border" : "bg-border/50")}
                />
              )}
              <Badge
                className={cn(
                  "px-2.5 py-1 text-xs cursor-pointer transition-colors duration-200 gap-1",
                  isCurrent
                    ? styles[status]
                    : isPast
                      ? "bg-muted text-muted-foreground border border-border/60"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent",
                  itemDisabled && "pointer-events-none opacity-60"
                )}
                onClick={() => select(status)}
              >
                {isPast && <Check className="h-3 w-3" />}
                {labelFor(labels, status)}
              </Badge>
            </div>
          )
        })}
      </div>
      {outcomes.length > 0 && (
        <>
          <div className="h-4 w-px bg-border/70" />
          <div className="flex items-center gap-1">
            {outcomes.map((status) => {
              const isCurrent = current === status
              const itemDisabled = isDisabledStatus(status)
              return (
                <Badge
                  key={status}
                  className={cn(
                    "px-2 py-0.5 text-xs cursor-pointer transition-colors duration-200",
                    isCurrent
                      ? styles[status]
                      : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent",
                    itemDisabled && "pointer-events-none opacity-60"
                  )}
                  onClick={() => select(status)}
                >
                  {labelFor(labels, status)}
                </Badge>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
