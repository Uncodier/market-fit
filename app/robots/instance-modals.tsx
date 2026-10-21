import { useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/app/components/ui/dialog"

import { Button } from "@/app/components/ui/button"

import { DeleteRobotModal } from "@/app/components/robots/DeleteRobotModal"
import { InstanceBrowserModal } from "@/app/components/robots/InstanceBrowserModal"

import { sortRobotInstances } from "@/lib/navigation/robots-instance"

import type { useWorkspaceTabs } from "./use-workspace-tabs"

export function InstanceModals(input: ReturnType<typeof useWorkspaceTabs>) {
  const { isBrowserModalOpen, setIsBrowserModalOpen, allInstances, handleOpenFromBrowser, setInstanceToDelete, setIsDeleteModalOpen, deletingInstanceIds, instanceToDelete, isDeleteModalOpen, setDeletingInstanceIds, activeRobotInstance, isResuming, isInstanceStarting, setIsResuming, setLocalSelectedInstanceId, refreshRobots, currentSite, getAllInstances, isLoadingRobots, maxVisibleTabs, searchParams, router, setLastAutoCreationAttempt, setIsAutoCreatingInstance, isEditModalOpen, setIsEditModalOpen, editingName, setEditingName, editingInstanceId, handleInstanceNameUpdate } = input
  // Preserve all instance fields while satisfying the browser's extensible DTO.
  const browserInstances = useMemo(() => allInstances.map(instance => ({ ...instance })), [allInstances])
  return (<>
      {/* Instance Browser Modal */}
      <InstanceBrowserModal
        isOpen={isBrowserModalOpen}
        onClose={() => setIsBrowserModalOpen(false)}
        instances={browserInstances}
        onSelect={(id) => {
          void handleOpenFromBrowser(id)
        }}
        onDelete={(instance: { id: string; name: string; requirement_title?: string }) => {
          const displayName = instance.requirement_title ? instance.requirement_title : (instance.name || `ag-${instance.id.slice(-4)}`)
          setInstanceToDelete({ id: instance.id, name: displayName })
          setIsDeleteModalOpen(true)
        }}
        deletingInstanceIds={deletingInstanceIds}
      />

      {/* Delete Confirmation Modal */}
      {instanceToDelete && (
        <DeleteRobotModal
          open={isDeleteModalOpen}
          onOpenChange={(open) => {
            setIsDeleteModalOpen(open)
            if (!open) {
              setInstanceToDelete(null)
            }
          }}
          instanceId={instanceToDelete.id}
          instanceName={instanceToDelete.name}
          onDeleteStart={(id) => {
            setDeletingInstanceIds(prev => {
              const next = new Set(prev)
              next.add(id)
              return next
            })
          }}
          onDeleteError={(id) => {
            setDeletingInstanceIds(prev => {
              if (!prev.has(id)) return prev
              const next = new Set(prev)
              next.delete(id)
              return next
            })
          }}
          onDeleteSuccess={async () => {
            
            // Save the deleted instance ID before clearing state
            const deletedInstanceId = instanceToDelete?.id
            
            // Check if the deleted instance was the active one or was starting
            const wasActiveInstance = activeRobotInstance?.id === deletedInstanceId
            const wasStarting = wasActiveInstance && (isResuming || isInstanceStarting)
            
            
            // Reset robot starting/resuming state if the deleted instance was starting
            if (wasStarting || wasActiveInstance) {
              setIsResuming(false)
            }
            
            // Clear instance to delete
            setInstanceToDelete(null)
            
            // Clear local selection immediately (but don't update URL yet to avoid intermediate state)
            setLocalSelectedInstanceId(null)
            
            try {
              // First refresh robots to get updated instance list (without the deleted one)
              await refreshRobots(currentSite?.id)
              
              // Wait for state to be fully updated - use a retry mechanism
              let currentInstances = getAllInstances()
              let retries = 0
              const maxRetries = 15
              
              // Wait until the deleted instance is confirmed to be removed from the list
              while (retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 100))
                currentInstances = getAllInstances()
                
                // Check if the deleted instance is no longer in the list
                const deletedStillExists = deletedInstanceId && currentInstances.some(inst => inst.id === deletedInstanceId)
                
                // Only proceed if deleted instance is confirmed removed OR we have instances
                if (!deletedStillExists) {
                  break
                }
                retries++
              }
              
              // Final check: ensure deleted instance is not in the list
              if (deletedInstanceId && currentInstances.some(inst => inst.id === deletedInstanceId)) {
                console.warn('🗑️ [Delete] WARNING: Deleted instance still in list after retries, filtering it out')
                currentInstances = currentInstances.filter(inst => inst.id !== deletedInstanceId)
              }
              
              // Find the best instance to navigate to - select the first VISIBLE one
              let targetInstanceId = 'new'
              
              if (currentInstances.length > 0) {
                // Sort instances by updated_at descending (most recently updated first)
                // This matches the order used in the tabs
                const sortedInstances = sortRobotInstances(currentInstances)
                
                // Calculate which instances are visible (same logic as in tab rendering)
                const showNewMakinaTab = currentInstances.length === 0 || isLoadingRobots
                const effectiveMaxTabs = showNewMakinaTab ? Math.max(1, maxVisibleTabs - 1) : Math.max(1, maxVisibleTabs)
                const totalTabs = sortedInstances.length
                const needsOverflow = totalTabs > effectiveMaxTabs
                
                let visibleInstances = []
                
                if (!needsOverflow) {
                  visibleInstances = sortedInstances
                } else {
                  // We don't have a selectedInstanceIndex to worry about swapping here, 
                  // just get the base visible ones
                  visibleInstances = sortedInstances.slice(0, effectiveMaxTabs)
                }
                
                // Select the first VISIBLE instance (not just first in sorted list)
                if (visibleInstances.length > 0) {
                  targetInstanceId = visibleInstances[0]?.id || 'new'
                } else {
                  // Fallback: if no visible instances (shouldn't happen), select first in list
                  targetInstanceId = sortedInstances[0]?.id || 'new'
                }
                
                // Set local selection and update URL atomically to avoid intermediate state
                setLocalSelectedInstanceId(targetInstanceId)
                
                // Navigate to the selected instance (update URL directly, skipping intermediate state)
                const newParams = new URLSearchParams(searchParams.toString())
                newParams.set('instance', targetInstanceId)
                
                // Clear artifact and tab state when changing instances after delete
                newParams.delete('artifact')
                newParams.delete('screen')
                newParams.delete('tab')
                
                if (targetInstanceId !== 'new') {
                  const targetInstance = currentInstances.find(inst => inst.id === targetInstanceId)
                  if (targetInstance) {
                    const displayName = targetInstance.requirement_title ? targetInstance.requirement_title : (targetInstance.name || `ag-${targetInstance.id.slice(-4)}`)
                    newParams.set('name', displayName)
                  }
                } else {
                  newParams.delete('name')
                }
                
                router.replace(`/robots?${newParams.toString()}`, { scroll: false })
              } else {
                // Prevent auto-create from triggering immediately after delete
                // Update lastAutoCreationAttempt to prevent auto-create for a short period
                setLastAutoCreationAttempt(Date.now())
                // Also set a flag to prevent auto-create during delete process
                setIsAutoCreatingInstance(true)
                // Reset the flag after a delay to allow auto-create to work normally later
                setTimeout(() => {
                  setIsAutoCreatingInstance(false)
                }, 3000) // 3 seconds delay before auto-create can trigger again
                
                // Set local selection and update URL atomically
                setLocalSelectedInstanceId(null)
                const newParams = new URLSearchParams(searchParams.toString())
                newParams.set('instance', 'new')
                newParams.delete('name')
                newParams.delete('artifact')
                newParams.delete('screen')
                newParams.delete('tab')
                router.replace(`/robots?${newParams.toString()}`, { scroll: false })
              }
              
            } catch (error) {
              console.error('🗑️ [Delete] Error in delete success callback:', error)
              // Fallback: just navigate to 'new' if something goes wrong
              // Also prevent auto-create in error case
              setLastAutoCreationAttempt(Date.now())
              setIsAutoCreatingInstance(true)
              setTimeout(() => {
                setIsAutoCreatingInstance(false)
              }, 3000)
              
              const params = new URLSearchParams(searchParams.toString())
              params.set('instance', 'new')
              params.delete('name')
              params.delete('artifact')
              params.delete('screen')
              params.delete('tab')
              router.replace(`/robots?${params.toString()}`)
            } finally {
              if (deletedInstanceId) {
                setDeletingInstanceIds(prev => {
                  if (!prev.has(deletedInstanceId)) return prev
                  const next = new Set(prev)
                  next.delete(deletedInstanceId)
                  return next
                })
              }
            }
          }}
        />
      )}
      
      {/* Edit Instance Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Edit instance</DialogTitle>
          </DialogHeader>
          <div className="p-4 py-6">
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Name
              </label>
              <input
                id="name"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && editingInstanceId) {
                    handleInstanceNameUpdate(editingInstanceId, editingName)
                    setIsEditModalOpen(false)
                  }
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Instance name"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (editingInstanceId) {
                handleInstanceNameUpdate(editingInstanceId, editingName)
                setIsEditModalOpen(false)
              }
            }}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  </>)
}
