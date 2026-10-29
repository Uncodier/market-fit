"use client"

import { useCallback, useId, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react"

export type IdentitySaveResult = void | { error?: string | null }

// Campaign and deal headers share the same edit session and Enter/blur race.
export function useInlineIdentityEdit({
  value,
  onSave,
  errorMessage,
  onError,
}: {
  value: string
  onSave: (next: string) => Promise<IdentitySaveResult>
  errorMessage: string
  onError: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()
  const sessionOpen = useRef(false)
  const pending = useRef(false)
  const retryRequired = useRef(false)
  const restoreFocus = useRef(false)

  const buttonRef = useCallback((node: HTMLButtonElement | null) => {
    if (node && restoreFocus.current) {
      restoreFocus.current = false
      node.focus()
    }
  }, [])

  const startEditing = () => {
    if (pending.current) return
    sessionOpen.current = true
    retryRequired.current = false
    setDraft(value)
    setError(null)
    setEditing(true)
  }

  const cancel = () => {
    // Escape cancels an unsent draft, not an already dispatched mutation.
    if (pending.current) return
    sessionOpen.current = false
    retryRequired.current = false
    setDraft(value)
    setError(null)
    setEditing(false)
  }

  const save = async (explicit: boolean) => {
    // Refs guard same-tick events and stale blur handlers after completion.
    if (!sessionOpen.current || pending.current || (!explicit && retryRequired.current)) return
    restoreFocus.current = explicit
    const next = draft.trim()
    if (!next || next === value) {
      cancel()
      return
    }

    pending.current = true
    retryRequired.current = true
    setSaving(true)
    setError(null)
    try {
      const result = await onSave(next)
      if (result?.error) throw new Error(result.error)
      sessionOpen.current = false
      setEditing(false)
    } catch {
      // Keep the draft. Only Enter explicitly retries an ambiguous/failed save.
      restoreFocus.current = false
      setError(errorMessage)
      onError()
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return
    if (event.key === "Enter") {
      event.preventDefault()
      void save(true)
    } else if (event.key === "Escape") {
      event.preventDefault()
      restoreFocus.current = true
      cancel()
    }
  }

  return {
    editing,
    error,
    errorId,
    buttonRef,
    startEditing,
    inputProps: {
      value: draft,
      readOnly: saving,
      "aria-busy": saving,
      "aria-invalid": Boolean(error),
      "aria-describedby": error ? errorId : undefined,
      onChange: (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
      onBlur: () => {
        restoreFocus.current = false
        void save(false)
      },
      onKeyDown,
    },
  }
}