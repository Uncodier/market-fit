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
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"

interface EditBacklogModalProps {
  open: boolean
  title: string
  onTitleChange: (title: string) => void
  onSave: () => void
  onClose: () => void
}

export const EditBacklogModal: React.FC<EditBacklogModalProps> = ({
  open,
  title,
  onTitleChange,
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
          <DialogTitle>Edit Backlog Item</DialogTitle>
          <DialogDescription>
            Update the title of this requirement. Press Escape to discard.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="backlog-title">Title</Label>
            <Input
              id="backlog-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Requirement title"
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
          <Button onClick={onSave} disabled={!title.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
