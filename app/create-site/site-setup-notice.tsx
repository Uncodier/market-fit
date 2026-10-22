"use client"

import { useLocalization } from "@/app/context/LocalizationContext"

import { useRef, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { localizeSetupFeedback } from './localized-feedback'
import type { SiteSetupFeedback } from './site-setup-feedback'

export function SiteSetupNotice({ feedback, onCheck }: {
  feedback: SiteSetupFeedback; onCheck: () => Promise<void>
}) {
  const { t } = useLocalization()
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
    <p className="text-sm font-medium">{t("account.setup.background", { status: t("account.setup." + feedback.status) })}</p>
    <p className="text-sm">{localizeSetupFeedback(feedback, t)}</p>
    {!feedback.workflowId && feedback.status !== 'complete' && <p className="text-sm text-muted-foreground">
      {t("account.setup.noWorkflow")}
    </p>}
    {feedback.workflowId && feedback.status !== 'complete' && <Button type="button" variant="outline"
      disabled={checking} onClick={() => void checkStatus()}>
      {checking ? t("account.setup.checking") : t("account.setup.check")}
    </Button>}
  </div>
}