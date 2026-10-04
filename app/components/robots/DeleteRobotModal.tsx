"use client"

import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { useToast } from "@/app/components/ui/use-toast"
import { deleteRobotInstance } from "@/app/robots/delete-robot-instance"

interface DeleteRobotModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: string
  instanceName: string
  onDeleteStart?: (instanceId: string) => void
  onDeleteSuccess?: () => void
  onDeleteError?: (instanceId: string) => void
}

export function DeleteRobotModal({
  open,
  onOpenChange,
  instanceId,
  instanceName,
  onDeleteStart,
  onDeleteSuccess,
  onDeleteError,
}: DeleteRobotModalProps) {
  const router = useRouter()
  const { toast } = useToast()

  const handleDelete = async () => {
    onDeleteStart?.(instanceId)
    try {
      await deleteRobotInstance(instanceId)
    } catch (error) {
      onDeleteError?.(instanceId)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Could not delete this agent instance",
        variant: "destructive",
      })
      throw error
    }

    toast({
      title: "Agent deleted",
      description: "The agent instance and its associated requirements were permanently removed.",
    })
    onDeleteSuccess?.()
    router.refresh()
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete agent instance"
      description={
        <>
          <span className="block font-medium text-foreground">
            {instanceName}-{instanceId.slice(-4)}
          </span>
          This cannot be undone. The instance, its associated requirements,
          requirement history, chat history, and plans will be permanently deleted.
        </>
      }
      confirmLabel="Delete"
      variant="destructive"
      dataPermission="allow"
      onConfirm={handleDelete}
    />
  )
}
