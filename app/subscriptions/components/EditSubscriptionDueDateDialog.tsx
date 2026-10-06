"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogForm, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { DueDateField } from "@/app/components/finance/DueDateField"
import { formatDueDate } from "@/lib/finance/due-date"
import { updateSubscriptionDueDate } from "../actions"
import type { SubscriptionDetail } from "../actions"

export function EditSubscriptionDueDateDialog({ subscription, open, onOpenChange, onSuccess }: {
  subscription: SubscriptionDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void | Promise<void>
}) {
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (open) setValue(subscription.due_date || "") }, [open, subscription.due_date])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const result = await updateSubscriptionDueDate(subscription.site_id, subscription.id, value || null)
      if (result.error) { toast.error(result.error); return }
      toast.success("Subscription due date saved")
      await onSuccess()
      onOpenChange(false)
    } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" busy={saving}>
        <DialogForm onSubmit={save}>
          <DialogHeader>
            <DialogTitle>Edit subscription due date</DialogTitle>
            <DialogDescription>Applies to future invoices only. Existing invoices keep their due dates.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <DueDateField id="edit-subscription-due-date" value={value} onChange={setValue} disabled={saving} description={`Next billing: ${formatDueDate(subscription.next_billing_date?.slice(0, 10))}. Each generated invoice keeps this billing-to-due offset in calendar days. Clear the date to remove the default.`} />
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  )
}