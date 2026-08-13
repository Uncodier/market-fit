"use client"

import { useRouter } from "next/navigation"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { useToast } from "@/app/components/ui/use-toast"

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
    const { apiClient } = await import("@/app/services/api-client-service")
    const response = await apiClient.post("/api/robots/instance/delete", {
      instance_id: instanceId,
    })

    if (!response.success) {
      onDeleteError?.(instanceId)
      toast({
        title: "Error",
        description:
          response.error?.message || "Could not delete this agent instance",
        variant: "destructive",
      })
      throw new Error(response.error?.message || "Failed to delete robot")
    }

    toast({
      title: "Agent deleted",
      description: "The agent instance was permanently removed.",
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
          This cannot be undone. Chat history, plans, and instance data will be
          permanently deleted.
        </>
      }
      confirmLabel="Delete"
      variant="destructive"
      onConfirm={handleDelete}
    />
  )
}
