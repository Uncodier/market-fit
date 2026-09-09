import React from 'react'
import {
  Loader,
  X,
  MessageSquare,
  Image as ImageIcon,
  PlayCircle,
  Zap,
  Smartphone,
  Monitor,
  File,
  ListTodo,
  Speaker,
} from '@/app/components/ui/icons'
import { Button } from '@/app/components/ui/button'
import { InstanceLog } from '../types'

const CONTEXT_KEYS = [
  'leads',
  'contents',
  'requirements',
  'tasks',
  'campaigns',
  'quotations',
  'deals',
  'records',
] as const

function parseContext(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return parsed && typeof parsed === 'object' ? parsed : null
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>
  return null
}

function countContextItems(context: Record<string, unknown> | null): number {
  if (!context) return 0
  return CONTEXT_KEYS.reduce((total, key) => {
    const value = context[key]
    return total + (Array.isArray(value) ? value.length : 0)
  }, 0)
}

export function getActivityMeta(activity: string) {
  switch (activity) {
    case 'plan':
      return { label: 'Plan', icon: ListTodo, color: 'text-purple-600' }
    case 'generate-image':
      return { label: 'Image', icon: ImageIcon, color: 'text-green-600' }
    case 'generate-video':
      return { label: 'Video', icon: PlayCircle, color: 'text-red-600' }
    case 'create-automation':
      return { label: 'Automation', icon: Zap, color: 'text-yellow-600' }
    case 'create-app':
      return { label: 'App', icon: Smartphone, color: 'text-sky-600' }
    case 'create-presentation':
      return { label: 'Presentation', icon: Monitor, color: 'text-indigo-600' }
    case 'create-document':
      return { label: 'Document', icon: File, color: 'text-teal-600' }
    default:
      return { label: 'Ask', icon: MessageSquare, color: 'text-blue-600' }
  }
}

function ContextChips({ log }: { log: InstanceLog }) {
  const attachments = Array.isArray(log.details?.attachments) ? log.details.attachments : []
  const contextCount = countContextItems(parseContext(log.details?.context))
  const images = attachments.filter((item: { type?: string }) => item?.type?.startsWith('image/')).length
  const videos = attachments.filter((item: { type?: string }) => item?.type?.startsWith('video/')).length
  const audios = attachments.filter((item: { type?: string }) => item?.type?.startsWith('audio/')).length
  const files = attachments.length - images - videos - audios

  if (attachments.length === 0 && contextCount === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {images > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <ImageIcon className="h-3 w-3" />
          {images}
        </span>
      )}
      {videos > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <PlayCircle className="h-3 w-3" />
          {videos}
        </span>
      )}
      {audios > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Speaker className="h-3 w-3" />
          {audios}
        </span>
      )}
      {files > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <File className="h-3 w-3" />
          {files}
        </span>
      )}
      {contextCount > 0 && (
        <span className="text-[11px] text-muted-foreground">
          {contextCount} {contextCount === 1 ? 'ref' : 'refs'}
        </span>
      )}
    </div>
  )
}

interface UserWorkflowMetaProps {
  log: InstanceLog
  onCancel?: (logId: string) => void
  isCancelling?: boolean
  compact?: boolean
}

export function UserWorkflowMeta({
  log,
  onCancel,
  isCancelling = false,
  compact = false,
}: UserWorkflowMetaProps) {
  const activity = log.details?.request_type || 'ask'
  const status = log.details?.status
  const isRunning = status === 'running'
  const { label, icon: Icon, color } = getActivityMeta(activity)

  if (!isRunning) return null

  return (
    <div className={`flex items-center gap-2 min-w-0 ${compact ? '' : 'mt-2 pt-2 border-t border-black/5 dark:border-white/5'}`}>
      <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
      <span className="text-xs font-medium text-foreground shrink-0">{label}</span>
      <ContextChips log={log} />
      <Loader className="h-3.5 w-3.5 shrink-0 text-muted-foreground animate-spin" />
      <span className="text-xs text-muted-foreground truncate">Running</span>
      {onCancel && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onCancel(log.id)}
          disabled={isCancelling}
          className="ml-auto h-6 w-6 shrink-0 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title="Cancel"
        >
          {isCancelling ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  )
}
