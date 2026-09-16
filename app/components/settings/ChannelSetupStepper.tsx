import { Check } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

export type ChannelSetupStepStatus = "complete" | "current" | "upcoming" | "error"

export interface ChannelSetupStep {
  label: string
  status: ChannelSetupStepStatus
}

export function ChannelSetupStepper({
  steps,
  className,
}: {
  steps: ChannelSetupStep[]
  className?: string
}) {
  return (
    <ol
      aria-label="Setup progress"
      className={cn("flex w-full items-start", className)}
    >
      {steps.map((step, index) => {
        const isComplete = step.status === "complete"
        const isCurrent = step.status === "current"
        const isError = step.status === "error"

        return (
          <li
            key={step.label}
            className="relative flex min-w-0 flex-1 flex-col items-center gap-2 text-center"
            aria-current={isCurrent || isError ? "step" : undefined}
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-1/2 top-4 h-px w-full",
                  step.status === "upcoming"
                    ? "bg-border"
                    : isError
                      ? "bg-destructive/50"
                      : "bg-primary"
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                isComplete && "border-primary bg-primary text-primary-foreground",
                isCurrent && "border-primary bg-background text-primary",
                isError && "border-destructive bg-destructive/10 text-destructive",
                step.status === "upcoming" && "border-border bg-background text-muted-foreground"
              )}
            >
              {isComplete ? <Check className="h-4 w-4" /> : isError ? "!" : index + 1}
            </span>
            <span
              className={cn(
                "relative z-10 max-w-full text-xs font-medium",
                step.status === "upcoming" ? "text-muted-foreground" : "text-foreground",
                isError && "text-destructive"
              )}
            >
              {step.label}
            </span>
            <span className="sr-only">
              {isComplete ? "Complete" : isError ? "Error" : isCurrent ? "Current step" : "Upcoming"}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
