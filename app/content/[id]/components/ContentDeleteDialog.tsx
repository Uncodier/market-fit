"use client"

import { useId, useRef, useState, useTransition } from "react"
import { Button } from "@/app/components/ui/button"
import { Checkbox } from "@/app/components/ui/checkbox"
import { Trash2 } from "@/app/components/ui/icons"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog"
import type { DeleteContentOptions, DeleteContentResult } from "../../delete-content-types"

type Props = {
  linkedPostCount: number
  onDelete: (options: DeleteContentOptions) => Promise<DeleteContentResult>
}

export function ContentDeleteDialog({ linkedPostCount, onDelete }: Props) {
  const checkboxId = useId()
  const [open, setOpen] = useState(false)
  const [deleteFromOutstand, setDeleteFromOutstand] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inFlight = useRef(false)

  const changeOpen = (value: boolean) => {
    if (inFlight.current) return
    setOpen(value)
    setDeleteFromOutstand(false)
    setError(null)
  }

  const changeDeleteFromOutstand = (value: boolean) => {
    if (inFlight.current) return
    setDeleteFromOutstand(value)
    setError(null)
  }

  const confirm = () => {
    if (inFlight.current) return
    inFlight.current = true
    setError(null)
    startTransition(async () => {
      try {
        const result = await onDelete({ deleteFromOutstand: linkedPostCount > 0 && deleteFromOutstand })
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
      <AlertDialogContent busy={isPending} aria-busy={isPending}>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Content</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this content? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {linkedPostCount > 0 && (
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Checkbox id={checkboxId} checked={deleteFromOutstand} disabled={isPending}
                onCheckedChange={value => changeDeleteFromOutstand(value === true)}
                aria-describedby={`${checkboxId}-help ${checkboxId}-limitations`} className="mt-0.5" />
              <label htmlFor={checkboxId} className="cursor-pointer font-medium leading-tight">
                Also delete linked posts from Outstand and social networks
              </label>
            </div>
            <p id={`${checkboxId}-help`} className="text-muted-foreground">
              {deleteFromOutstand
                ? `This will cancel scheduled posts and delete published posts where supported (${linkedPostCount} linked ${linkedPostCount === 1 ? "post" : "posts"}). If any deletion fails or is unsupported, local content will be kept; posts already removed cannot be restored.`
                : "Only the local content will be deleted. Published and scheduled posts will remain in Outstand and may still appear in the content list."}
            </p>
            <p id={`${checkboxId}-limitations`} className="text-muted-foreground">
              Published Instagram and TikTok posts must be deleted directly in each app; Outstand cannot delete them via API.
              To delete only this local content, leave the option unchecked. Scheduled posts that have not been published can still be cancelled through Outstand.
            </p>
          </div>
        )}
        {error && (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            {linkedPostCount > 0 && deleteFromOutstand && (
              <Button type="button" variant="outline" size="sm" disabled={isPending}
                onClick={() => changeDeleteFromOutstand(false)}>
                Switch to local-only deletion
              </Button>
            )}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={isPending} data-permission="delete"
            className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
            onClick={event => { event.preventDefault(); confirm() }}>
            {isPending ? "Deleting..." : linkedPostCount > 0 && !deleteFromOutstand ? "Delete local content" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}