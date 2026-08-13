"use client"

import * as React from "react"
import { Button } from "@/app/components/ui/button"
import { Spinner } from "@/app/components/ui/spinner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "destructive"
  loading?: boolean
  onConfirm: () => void | Promise<void>
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = React.useState(false)
  const isLoading = loading || pending

  const handleConfirm = async (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault()
    setPending(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch {
      // Keep the dialog open so the user can retry.
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isLoading) onOpenChange(next)
      }}
    >
      <AlertDialogContent busy={isLoading} size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {cancelLabel}
          </AlertDialogCancel>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={isLoading}
            onClick={(event) => {
              void handleConfirm(event)
            }}
          >
            {isLoading ? <Spinner className="mr-2 h-4 w-4" /> : null}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
