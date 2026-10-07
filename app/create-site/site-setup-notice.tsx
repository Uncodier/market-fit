"use client"

import { useRef, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import type { SiteSetupFeedback } from './site-setup-feedback'

export function SiteSetupNotice({ feedback, onCheck }: {
  feedback: SiteSetupFeedback; onCheck: () => Promise<void>
}) {
  const [checking, setChecking] = useState(false)
  const checkingStarted = useRef(false)
  const checkStatus = async () => {
    if (!feedback.workflowId || checkingStarted.current) return
    checkingStarted.current = true
    setChecking(true)
    try { await onCheck() } finally {
      checkingStarted.current = false
      setChecking(false)
    }
  }
  return <div role="status" aria-live="polite" className="rounded-md border p-4 my-4 space-y-2">
    <p className="text-sm font-medium">Background setup: {feedback.status}</p>
    <p className="text-sm">{feedback.message}</p>
    {!feedback.workflowId && feedback.status !== 'complete' && <p className="text-sm text-muted-foreground">
      No workflow ID is available yet. Setup will not be restarted automatically.
    </p>}
    {feedback.workflowId && feedback.status !== 'complete' && <Button type="button" variant="outline"
      disabled={checking} onClick={() => void checkStatus()}>
      {checking ? 'Checking setup status...' : 'Check setup status'}
    </Button>}
  </div>
}