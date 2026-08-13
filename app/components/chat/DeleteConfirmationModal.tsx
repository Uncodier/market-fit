"use client"

import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"

interface DeleteConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversationId: string
  conversationTitle: string | undefined
  onDelete: (conversationId: string) => Promise<void>
}

export function DeleteConfirmationModal({
  open,
  onOpenChange,
  conversationId,
  conversationTitle,
  onDelete,
}: DeleteConfirmationModalProps) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete conversation"
      description={
        <>
          This cannot be undone. All messages in{" "}
          <span className="font-medium text-foreground">
            {conversationTitle || "Untitled conversation"}
          </span>{" "}
          will be permanently deleted.
        </>
      }
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={() => onDelete(conversationId)}
    />
  )
}
