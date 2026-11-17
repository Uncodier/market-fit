import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { toast } from "sonner"

export function ImprentaDataNotice({ graphError, logsError, onRetry }: {
  graphError: unknown
  logsError: unknown
  onRetry: () => Promise<unknown>
}) {
  const [retrying, setRetrying] = useState(false)
  if (!graphError && !logsError) return null
  return <div role="alert" className="absolute left-4 right-4 top-36 z-40 flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-2 text-sm shadow-sm">
    <span>{graphError
      ? "Canvas data is unavailable. Retry loading before generating or publishing."
      : "Some result details could not load. Publishing requires a successful reload."}</span>
    <Button variant="outline" size="sm" disabled={retrying} onClick={async () => {
      setRetrying(true)
      try {
        await onRetry()
      } catch {
        toast.error("Could not reload canvas data. Please try again.")
      } finally {
        setRetrying(false)
      }
    }}>{retrying ? "Retrying…" : "Retry"}</Button>
  </div>
}