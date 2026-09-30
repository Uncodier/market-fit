'use client'

import { Card, CardContent } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { EmptyCard } from '@/app/components/ui/empty-card'
import { Skeleton } from '@/app/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/components/ui/dropdown-menu'
import { ClipboardList, MoreVertical } from '@/app/components/ui/icons'
import { CollapsibleField } from './collapsible-field'
import type { SavedFinderList } from './use-saved-finder-lists'

interface SavedListsPanelProps {
  lists: SavedFinderList[]
  loading: boolean
  error: boolean
  onRetry: () => void
  onLoad: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (list: SavedFinderList) => void
  t: (key: string) => string
  openSections: Record<string, boolean>
  onSectionOpenChange: (status: string, open: boolean) => void
}

export function SavedListsPanel({ lists, loading, error, onRetry, onLoad, onDelete, onEdit, t, openSections, onSectionOpenChange }: SavedListsPanelProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <CollapsibleField key={index} title="Loading..." defaultOpen={false}>
            <Card className="border border-border">
              <CardContent className="p-2.5 flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-7 w-7 rounded-md flex-shrink-0" />
              </CardContent>
            </Card>
          </CollapsibleField>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-muted-foreground">Could not load saved lists. Please try again.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>Retry</Button>
      </div>
    )
  }

  if (lists.length === 0) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center w-full">
        <EmptyCard
          variant="fancy"
          showShadow={false}
          className="max-w-sm border-0 shadow-none bg-transparent"
          icon={<ClipboardList className="h-6 w-6" />}
          title={t('people.saved.empty.title') || 'No saved lists yet'}
          description={t('people.saved.empty.desc') || 'Save search results to lists from the Search people tab to see them here.'}
        />
      </div>
    )
  }

  const groupedByStatus = lists.reduce((groups, list) => {
    const rawStatus = list.status || 'unknown'
    const status = rawStatus === 'mining' || rawStatus === 'running' ? 'in_progress' : rawStatus
    const group = ['in_progress', 'pending', 'completed', 'failed'].includes(status) ? status : 'unknown'
    ;(groups[group] ??= []).push(list)
    return groups
  }, {} as Record<string, SavedFinderList[]>)

  const statusLabels: Record<string, string> = {
    in_progress: t('people.saved.status.inProgress') || 'In Progress',
    pending: t('people.saved.status.pending') || 'Pending',
    completed: t('people.saved.status.completed') || 'Completed',
    failed: t('people.saved.status.failed') || 'Failed',
    unknown: t('people.saved.status.other') || 'Other',
  }

  return (
    <div className="space-y-3">
      {['in_progress', 'pending', 'completed', 'failed', 'unknown'].map(status => {
        const group = groupedByStatus[status]
        if (!group?.length) return null
        return (
          <CollapsibleField
            key={status}
            title={statusLabels[status]}
            defaultOpen={openSections[status] ?? true}
            onOpenChange={open => onSectionOpenChange(status, open)}
            countBadge={group.length}
          >
            <div className="space-y-1.5">
              {group.map(list => (
                <Card
                  key={list.id}
                  className="border border-border hover:border-foreground/20 transition-colors cursor-pointer"
                  onClick={() => onLoad(list.id)}
                >
                  <CardContent className="p-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-medium truncate text-sm flex-1 min-w-0">
                        {list.name?.trim() || `List ${list.id.slice(0, 8)}…`}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 flex-shrink-0"
                            onClick={event => event.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={event => event.stopPropagation()}>
                          <DropdownMenuItem onClick={event => { event.stopPropagation(); onLoad(list.id) }}>
                            {t('people.saved.actions.load') || 'Load'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={event => { event.stopPropagation(); onEdit(list) }}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={event => { event.stopPropagation(); onDelete(list.id) }}
                            className="text-destructive focus:text-destructive"
                          >
                            {t('people.saved.actions.delete') || 'Delete'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CollapsibleField>
        )
      })}
    </div>
  )
}