"use client"

import { useState } from "react"
import { toast } from "sonner"
import { ImprentaContextTypeSelect } from "@/app/components/agents/imprenta-context-type-select"
import { Button } from "@/app/components/ui/button"
import { Card } from "@/app/components/ui/card"
import { Trash2, X } from "@/app/components/ui/icons"
import { ScreenAnchoredPanel } from "@/app/components/ui/screen-anchored-panel"
import {
  MAX_RELATION_CONTEXT_LENGTH,
  WORKFLOW_RELATION_GROUPS,
  workflowRelationContext,
} from "./workflow-relation-context"

export function WorkflowRelationEditor({
  stepId,
  context,
  anchor,
  onChange,
  onDisconnect,
  onClose,
}: {
  stepId: string
  context: string
  anchor: { x: number; y: number }
  onChange: (stepId: string, context: string) => Promise<unknown>
  onDisconnect: (stepId: string) => Promise<unknown>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)

  const save = async (value: string) => {
    if (busy) return
    const next = workflowRelationContext(value)
    if (next === context) return
    setBusy(true)
    try {
      await onChange(stepId, next)
    } catch {
      toast.error("Could not save relation context")
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onDisconnect(stepId)
      onClose()
    } catch {
      toast.error("Could not disconnect step")
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenAnchoredPanel anchor={anchor}>
      <Card
        aria-label="Relation editor"
        className="pointer-events-auto z-50 flex items-center gap-1 border-primary/30 p-1 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <ImprentaContextTypeSelect
          value={context}
          groups={WORKFLOW_RELATION_GROUPS}
          maxLength={MAX_RELATION_CONTEXT_LENGTH}
          onValueChange={(value) => void save(value)}
        />
        <div className="mx-1 h-4 w-px bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete relation"
          title="Disconnect step"
          disabled={busy}
          onClick={() => void disconnect()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Close relation editor"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </Card>
    </ScreenAnchoredPanel>
  )
}