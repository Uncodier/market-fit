"use client"

import { useCallback, useState } from "react"

export function useDirtyDialogClose({
  dirty,
  busy = false,
  onOpenChange,
}: {
  dirty: boolean
  busy?: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [discardOpen, setDiscardOpen] = useState(false)

  const requestClose = useCallback(() => {
    if (busy) return
    if (dirty) {
      setDiscardOpen(true)
      return
    }
    onOpenChange(false)
  }, [busy, dirty, onOpenChange])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        onOpenChange(true)
        return
      }
      requestClose()
    },
    [onOpenChange, requestClose]
  )

  const confirmDiscard = useCallback(() => {
    setDiscardOpen(false)
    onOpenChange(false)
  }, [onOpenChange])

  return {
    discardOpen,
    setDiscardOpen,
    requestClose,
    handleOpenChange,
    confirmDiscard,
  }
}
