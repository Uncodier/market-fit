"use client"

import { useId, useRef, useState, type FormEvent } from "react"
import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogForm,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog"
import { Archive, Loader2 } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { leaveArchivedSite, requestSiteArchive } from "@/lib/sites/archive-site-client"

export function SiteArchiveDialog({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [archived, setArchived] = useState(false)
  const inFlight = useRef(false)
  const passwordId = useId()
  const errorId = useId()

  const handleOpenChange = (nextOpen: boolean) => {
    if (inFlight.current || archived) return
    setPassword("")
    setError(null)
    setOpen(nextOpen)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // The dialog is portaled, but React events still bubble to the settings form.
    event.stopPropagation()
    if (inFlight.current || archived || !password) return

    inFlight.current = true
    setIsSubmitting(true)
    setError(null)
    try {
      await requestSiteArchive(siteId, password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to archive the site. Please try again.")
      inFlight.current = false
      setIsSubmitting(false)
      return
    }

    setPassword("")
    setOpen(false)
    setArchived(true)
    leaveArchivedSite(siteId)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="destructive" disabled={archived}>
          <Archive className="mr-2 h-4 w-4" aria-hidden={true} />
          {archived ? "Site archived" : "Archive site"}
        </Button>
      </DialogTrigger>
      <DialogContent size="sm" busy={isSubmitting} showClose={!isSubmitting}>
        <DialogForm onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <DialogHeader>
            <DialogTitle>Archive site</DialogTitle>
            <DialogDescription>
              Archive “{siteName}”? You will leave this workspace and its data will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The site&apos;s URL and allowed domains will be released for reuse.
              There is no self-service restore.
            </p>
            <p className="text-sm text-muted-foreground">
              Archiving does not cancel subscriptions or stop external workflows.
              Manage those separately before archiving.
            </p>
            <div className="space-y-2">
              <Label htmlFor={passwordId}>Account password</Label>
              <Input
                id={passwordId}
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Your password is used only to confirm this request and is not stored.
              </p>
            </div>
            {error && <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting || !password}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden={true} />}
              {isSubmitting ? "Archiving…" : "Archive site"}
            </Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}