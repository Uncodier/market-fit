import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/app/components/ui/use-toast'

export interface BacklogItem {
  id: string
  title: string
  status: string
  kind?: string
  tier?: string
  acceptance?: string[]
}

export interface BacklogData {
  items: BacklogItem[]
}

interface UseBacklogManagementProps {
  activeRobotInstance?: { id?: string; name?: string; requirement_backlog?: BacklogData | string } | null
  requirementIdFromStatus?: string | null
  sourceBacklog?: BacklogData | string | null
}

function extractRequirementIdFromName(name?: string): string | null {
  if (!name) return null
  if (name.startsWith('req-runner-')) return name.replace('req-runner-', '')
  if (name.startsWith('req-maint-')) return name.replace('req-maint-', '')
  return null
}

function parseBacklog(backlog: BacklogData | string | null | undefined): BacklogData | null {
  if (!backlog) return null
  if (typeof backlog === 'string') {
    try {
      return JSON.parse(backlog)
    } catch {
      return null
    }
  }
  return backlog
}

export const useBacklogManagement = ({
  activeRobotInstance,
  requirementIdFromStatus,
  sourceBacklog,
}: UseBacklogManagementProps) => {
  const { toast } = useToast()
  const [localBacklog, setLocalBacklog] = useState<BacklogData | null>(null)
  const [isEditBacklogModalOpen, setIsEditBacklogModalOpen] = useState(false)
  const [editingBacklogItem, setEditingBacklogItem] = useState<BacklogItem | null>(null)
  const [editBacklogTitle, setEditBacklogTitle] = useState('')

  useEffect(() => {
    setLocalBacklog(null)
    setIsEditBacklogModalOpen(false)
    setEditingBacklogItem(null)
    setEditBacklogTitle('')
  }, [activeRobotInstance?.id])

  const requirementBacklog = localBacklog ?? sourceBacklog ?? null

  const openEditBacklogModal = useCallback((item: BacklogItem) => {
    setEditingBacklogItem(item)
    setEditBacklogTitle(item.title)
    setIsEditBacklogModalOpen(true)
  }, [])

  const closeEditBacklogModal = useCallback(() => {
    setIsEditBacklogModalOpen(false)
    setEditingBacklogItem(null)
    setEditBacklogTitle('')
  }, [])

  const saveBacklogItem = useCallback(async () => {
    if (!editingBacklogItem || !editBacklogTitle.trim()) return

    const requirementId =
      requirementIdFromStatus ||
      extractRequirementIdFromName(activeRobotInstance?.name)

    if (!requirementId) {
      toast({
        title: 'Error saving backlog item',
        description: 'Could not determine requirement ID',
        variant: 'destructive',
      })
      return
    }

    const parsedBacklog = parseBacklog(requirementBacklog)
    if (!parsedBacklog || !Array.isArray(parsedBacklog.items)) {
      toast({
        title: 'Error saving backlog item',
        description: 'Backlog data is not available',
        variant: 'destructive',
      })
      return
    }

    const updatedBacklog: BacklogData = {
      ...parsedBacklog,
      items: parsedBacklog.items.map((item) =>
        item.id === editingBacklogItem.id
          ? { ...item, title: editBacklogTitle.trim() }
          : item
      ),
    }

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('requirements')
        .update({ backlog: updatedBacklog })
        .eq('id', requirementId)

      if (error) throw error

      setLocalBacklog(updatedBacklog)
      closeEditBacklogModal()
    } catch (error) {
      console.error('Error updating backlog item:', error)
      toast({
        title: 'Error saving backlog item',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      })
    }
  }, [
    editingBacklogItem,
    editBacklogTitle,
    requirementIdFromStatus,
    activeRobotInstance?.name,
    requirementBacklog,
    toast,
    closeEditBacklogModal,
  ])

  return {
    requirementBacklog,
    isEditBacklogModalOpen,
    editBacklogTitle,
    setEditBacklogTitle,
    openEditBacklogModal,
    closeEditBacklogModal,
    saveBacklogItem,
  }
}
