"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { deleteDeal } from "@/app/deals/actions"
import type { Deal } from "@/app/deals/types"
import { useOptionalPermissions } from "@/app/context/PermissionContext"
import { Button } from "@/app/components/ui/button"
import { MoreHorizontal, Trash2 } from "@/app/components/ui/icons"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"

export function DealHeaderActions({ deal }: { deal: Pick<Deal, "id" | "name"> }) {
  const router = useRouter()
  const permissions = useOptionalPermissions()
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const pending = useRef(false)
  const canDelete = !permissions || permissions.can("delete")

  const handleDelete = async () => {
    if (pending.current || !canDelete) return
    pending.current = true
    setDeleting(true)
    try {
      const result = await deleteDeal(deal.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      setOpen(false)
      toast.success("Deal deleted")
      router.replace("/deals")
    } catch {
      toast.error("Failed to delete deal")
    } finally {
      pending.current = false
      setDeleting(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Deal options" disabled={deleting}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            disabled={!canDelete || deleting}
            onSelect={() => setOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={open} onOpenChange={(next) => { if (!pending.current) setOpen(next) }}>
        <AlertDialogContent busy={deleting}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete deal?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deal.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-permission="delete"
              className="bg-destructive"
              disabled={deleting || !canDelete}
              onClick={(event) => { event.preventDefault(); void handleDelete() }}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}