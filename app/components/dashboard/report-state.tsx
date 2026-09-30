"use client"

import { Button } from "@/app/components/ui/button"

export function ReportState({
  state, message, onRetry,
}: {
  state: "loading" | "empty" | "error"
  message: string
  onRetry?: () => void
}) {
  return (
    <div role={state === "error" ? "alert" : "status"} className="flex min-h-32 flex-col items-center justify-center gap-3 p-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {state === "error" && onRetry && (
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>
      )}
    </div>
  )
}