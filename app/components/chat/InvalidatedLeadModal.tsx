"use client"

import React from "react"
import { Button } from "@/app/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"

interface InvalidatedLeadModalProps {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
  isDeleting?: boolean
}

export function InvalidatedLeadModal({
  isOpen,
  onConfirm,
  onCancel,
  isDeleting = false
}: InvalidatedLeadModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Lead Invalidated</DialogTitle>
          <DialogDescription>
            The lead associated with this conversation has been deleted or invalidated. 
            Would you like to delete this conversation and its messages?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Conversation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
