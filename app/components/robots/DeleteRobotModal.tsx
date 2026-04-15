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
          title: "Makina Eliminada",
          description: "La instancia del agent se ha eliminado permanentemente.",
        })
        
        // Call success callback if provided
        if (onDeleteSuccess) {
          onDeleteSuccess()
        }
        
        // Close modal
        onOpenChange(false)
      } else {
        throw new Error(response.error?.message || 'Failed to delete robot')
      }
    } catch (error) {
      console.error("Error deleting robot instance:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error al eliminar la instancia del agent",
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
            Eliminar Conversación
          </AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que deseas eliminar esta conversación? Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="py-4 space-y-3">
          <div className="mt-2 p-2 border rounded bg-muted/50">
            <span className="font-medium text-sm">{instanceName}-{instanceId.slice(-4)}</span>
          </div>
          
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
            <p className="text-sm font-medium text-destructive">
              ⚠️ Todos los datos de la instancia del agent se perderán permanentemente
            </p>
          </div>
          
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Configuración y estado de la instancia</li>
            <li>Historial de chat y mensajes</li>
            <li>Planes y registros de ejecución</li>
            <li>Todos los datos asociados</li>
          </ul>
        </div>
        
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <div className="h-4 w-4 mr-2 animate-pulse bg-muted rounded" />
                Eliminando...
              </>
            ) : (
              <>Eliminar Conversación</>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

