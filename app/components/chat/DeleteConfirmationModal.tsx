"use client"

import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import * as Icons from "@/app/components/ui/icons"

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
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      console.log(`🗑️ Deleting conversation: ${conversationId}`)
      await onDelete(conversationId)
      console.log(`✅ Conversation deleted successfully`)
    } catch (error) {
      console.error("Error deleting conversation:", error)
    } finally {
      setIsDeleting(false)
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icons.AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Conversation
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this conversation? This action cannot be undone and 
            all messages in this conversation will be permanently deleted.
          </AlertDialogDescription>
          <div className="mt-2 p-2 border rounded bg-muted/50">
            <span className="font-medium text-sm">{conversationTitle || "Untitled Conversation"}</span>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <div className="h-4 w-4 mr-2 animate-pulse bg-muted rounded" />
                Deleting...
              </>
            ) : (
              <>Delete</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
} 