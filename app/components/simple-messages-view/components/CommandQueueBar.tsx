import React from 'react'
import { ListTodo, ArrowUp, Pencil, X } from '@/app/components/ui/icons'
import { Button } from '@/app/components/ui/button'
import { getActivityMeta } from './UserWorkflowMeta'
import type { PendingWorkRow } from '../hooks/pending-work'

interface CommandQueueBarProps {
  items: PendingWorkRow[]
  onRemove: (pendingId: string) => void
  onEdit: (item: PendingWorkRow) => void
  onSendNow: (pendingId: string) => void
  sendingId?: string | null
}

export function CommandQueueBar({ items, onRemove, onEdit, onSendNow, sendingId }: CommandQueueBarProps) {
  if (items.length === 0) return null

  return (
    <div className="w-full relative pointer-events-auto mb-2">
      <div className="mx-auto max-w-[800px] rounded-lg border border-black/5 dark:border-white/5 bg-background/95 px-3 py-2 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
          <ListTodo className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">
            Waiting · {items.length} {items.length === 1 ? 'command' : 'commands'}
          </span>
        </div>
        <div className="space-y-1">
          {items.map((item) => {
            const activity = getActivityMeta(item.activity || 'ask')
            const isSending = sendingId === item.id
            return (
              <div key={item.id} className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted-foreground shrink-0">{activity.label}</span>
                <span className="text-xs text-foreground truncate">{item.message}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(item)}
                  disabled={isSending}
                  className="ml-auto h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Edit command"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onSendNow(item.id)}
                  disabled={Boolean(sendingId)}
                  className="h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                  title="Send now"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  <span className="sr-only">Send now</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(item.id)}
                  disabled={isSending}
                  className="h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
