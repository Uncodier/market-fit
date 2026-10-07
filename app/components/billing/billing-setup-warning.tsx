"use client"

import { Button } from "@/app/components/ui/button"

export function BillingSetupWarning({ message, isLoading, onRetry }: {
  message: string
  isLoading: boolean
  onRetry?: () => void
}) {
  return (
    <div role="alert" className="my-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 space-y-3">
      <p className="text-sm">{message}</p>
      {onRetry && <Button type="button" variant="outline" disabled={isLoading} onClick={onRetry}>
        {isLoading ? "Confirming billing setup..." : "Retry billing setup"}
      </Button>}
    </div>
  )
}