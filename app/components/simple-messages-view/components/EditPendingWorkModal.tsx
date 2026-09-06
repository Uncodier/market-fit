import React from "react"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Textarea } from "@/app/components/ui/textarea"
import { Label } from "@/app/components/ui/label"

interface EditPendingWorkModalProps {
  open: boolean
  message: string
  onMessageChange: (message: string) => void
  onSave: () => void
  onClose: () => void
}

export const EditPendingWorkModal: React.FC<EditPendingWorkModalProps> = ({
  open,
  message,
  onMessageChange,
  onSave,
  onClose,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Edit Command</DialogTitle>
          <DialogDescription>
            Update the text of this pending command before sending.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="pending-message">Message</Label>
            <Textarea
              id="pending-message"
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              placeholder="What should the agent do?"
              className="min-h-[100px] resize-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  onSave()
                }
              }}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!message.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
