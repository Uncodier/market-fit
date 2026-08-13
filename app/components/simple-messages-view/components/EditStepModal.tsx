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

interface EditStepModalProps {
  open: boolean
  title: string
  description: string
  onTitleChange: (title: string) => void
  onDescriptionChange: (description: string) => void
  onSave: () => void
  onClose: () => void
}

export const EditStepModal: React.FC<EditStepModalProps> = ({
  open,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
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
          <DialogTitle>Edit step</DialogTitle>
          <DialogDescription>
            Update the title and description. Press Escape to discard.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Step title"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  onSave()
                }
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              className="min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder="What this step is about"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) {
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
