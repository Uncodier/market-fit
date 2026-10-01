"use client"

import { useEffect, useId, useRef, useState, useTransition } from "react"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Trash2 } from "@/app/components/ui/icons"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog"
import type { DeleteContentOptions, DeleteContentResult } from "../../delete-content-types"
import type { ContentDeletionPreviewResult } from "../../content-deletion-preview"
import { getContentDeletionPreview } from "../../get-content-deletion-preview"
import { ContentDeletionSummary } from "./ContentDeletionSummary"
import { contentDeletionCopy } from "./content-deletion-copy"

type Props = {
  contentId?: string
  linkedPostCount: number
  onDelete: (options: DeleteContentOptions) => Promise<DeleteContentResult>
}

export function ContentDeleteDialog({ contentId, linkedPostCount, onDelete }: Props) {
  const checkboxId = useId()
  const [open, setOpen] = useState(false)
  const [deleteFromOutstand, setDeleteFromOutstand] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inFlight = useRef(false)
  const [verification, setVerification] = useState<{ contentId: string; result: ContentDeletionPreviewResult } | null>(null)
  const result = verification?.contentId === contentId ? verification?.result : undefined
  const preview = result?.success ? result.data : null
  const count = preview?.linkedPostCount ?? linkedPostCount
  const checking = open && Boolean(contentId) && !result
  const canDeleteRemotely = Boolean(preview?.canDeleteRemotely)
  const copy = contentDeletionCopy(preview)

  useEffect(() => {
    if (!open || !contentId) return
    let active = true
    void getContentDeletionPreview(contentId).then(result => {
      if (active) setVerification({ contentId, result })
    }).catch(() => {
      if (active) setVerification({ contentId, result: { success: false, error: "Unable to verify linked social posts." } })
    })
    return () => { active = false }
  }, [open, contentId])

  const changeOpen = (value: boolean) => {
    if (inFlight.current) return
    setOpen(value)
    setDeleteFromOutstand(false)
    setError(null)
    setVerification(null)
  }

  const changeDeleteFromOutstand = (value: boolean) => {
    if (inFlight.current) return
    setDeleteFromOutstand(value)
    setError(null)
  }

  const confirm = () => {
    if (inFlight.current || (deleteFromOutstand && !canDeleteRemotely)) return
    inFlight.current = true
    setError(null)
    startTransition(async () => {
      try {
        const result = await onDelete({ deleteFromOutstand: count > 0 && deleteFromOutstand })
        if (result.success) setOpen(false)
        else setError(result.error)
      } catch {
        setError("Content deletion could not be confirmed. Refresh and check the post status before retrying.")
      } finally {
        inFlight.current = false
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={changeOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" data-permission="delete"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label="Delete content">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent busy={isPending} aria-busy={isPending} className="max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Content</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this content? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {checking && <p role="status" className="text-sm text-muted-foreground">Checking linked posts and deletion support…</p>}
        {!checking && ((result && !result.success) || (!contentId && count > 0)) && (
          <p role="status" className="text-sm text-muted-foreground">
            {result && !result.success ? result.error : "Unable to verify linked social posts."}
            {" "}Remote deletion is unavailable. Local-only deletion will leave any linked posts unchanged.
          </p>
        )}
        {preview && count > 0 && <ContentDeletionSummary preview={preview} />}
        {count > 0 && (
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Checkbox id={checkboxId} checked={deleteFromOutstand} disabled={isPending || !canDeleteRemotely}
                onCheckedChange={value => changeDeleteFromOutstand(value === true)}
                aria-describedby={`${checkboxId}-help`} className="mt-0.5" />
              <label htmlFor={checkboxId} className="cursor-pointer font-medium leading-tight">
                {checking ? "Checking combined deletion availability…" : canDeleteRemotely ? copy.option : "Combined deletion unavailable"}
              </label>
            </div>
            <p id={`${checkboxId}-help`} className="text-muted-foreground">
              {deleteFromOutstand
                ? "This applies to every linked post listed above. Status and permissions are checked again when deleting. If any deletion fails, local content will be kept; posts already removed cannot be restored."
                : copy.localHelp}
            </p>
          </div>
        )}
        {error && (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            {count > 0 && deleteFromOutstand && (
              <Button type="button" variant="outline" size="sm" disabled={isPending}
                onClick={() => changeDeleteFromOutstand(false)}>
                Switch to local-only deletion
              </Button>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isPending || (deleteFromOutstand && !canDeleteRemotely)} data-permission="delete"
            className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
            onClick={event => { event.preventDefault(); confirm() }}>
            {isPending ? "Deleting..." : deleteFromOutstand ? copy.confirm : count > 0 ? "Delete local content" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}