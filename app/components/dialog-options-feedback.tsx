import { Button } from './ui/button'

export interface DialogOptionsStatus {
  ready: boolean
  error: string
  retry: () => void
}

/** Never present a pending/failed directory as an authoritative empty picker. */
export function DialogOptionsFeedback({ status }: { status: DialogOptionsStatus }) {
  if (status.ready) return null
  if (!status.error) return <p role="status" className="text-sm text-muted-foreground">Loading options…</p>
  return <div className="space-y-2">
    <p role="alert" className="text-sm text-destructive">Could not load {status.error}.</p>
    <Button type="button" variant="outline" size="sm" onClick={status.retry}>Retry loading options</Button>
  </div>
}