"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { AlertTriangle } from "@/app/components/ui/icons"
import { useToast } from "@/app/components/ui/use-toast"

interface DeleteRobotModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  instanceId: string
  instanceName: string
  onDeleteSuccess?: () => void
}

export function DeleteRobotModal({
  open,
  onOpenChange,
  instanceId,
  instanceName,
  onDeleteSuccess,
}: DeleteRobotModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      console.log(`🗑️ Deleting robot instance: ${instanceId}`)
      
      const { apiClient } = await import('@/app/services/api-client-service')
      const response = await apiClient.post('/api/robots/instance/delete', {
        instance_id: instanceId
      })
      
      if (response.success) {
        console.log(`✅ Robot instance deleted successfully`)
        toast({
          title: "Robot Deleted",
          description: "The robot instance has been permanently deleted.",
        })
        
        // Call success callback if provided
        if (onDeleteSuccess) {
          onDeleteSuccess()
        }
        
        // Navigate to 'new' tab
        router.push('/robots?instance=new')
        
        // Close modal
        onOpenChange(false)
      } else {
        throw new Error(response.error?.message || 'Failed to delete robot')
      }
    } catch (error) {
      console.error("Error deleting robot instance:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete robot instance",
        variant: "destructive"
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Robot Instance
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this robot instance? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="mt-2 p-2 border rounded bg-muted/50">
            <span className="font-medium text-sm">{instanceName}-{instanceId.slice(-4)}</span>
          </div>
          
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
            <p className="text-sm font-medium text-destructive">
              ⚠️ All robot instance data will be permanently lost
            </p>
          </div>
          
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Instance configuration and state</li>
            <li>Chat history and messages</li>
            <li>Plans and execution logs</li>
            <li>All associated data</li>
          </ul>
        </div>
        
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
              <>Delete Robot</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

