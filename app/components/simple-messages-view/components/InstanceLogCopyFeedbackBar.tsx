"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Copy, Check, ThumbsUp, ThumbsDown, AlertTriangle } from '@/app/components/ui/icons'
import { useToast } from '@/app/components/ui/use-toast'
import { cn } from '@/lib/utils'

export type LogFeedbackRating = 'good' | 'bad' | 'problematic'

type UserFeedbackDetails = {
  rating: LogFeedbackRating
  rated_at: string
}

function readFeedback(details: unknown): UserFeedbackDetails | null {
  if (!details || typeof details !== 'object') return null
  const uf = (details as Record<string, unknown>).user_feedback
  if (!uf || typeof uf !== 'object') return null
  const r = (uf as Record<string, unknown>).rating
  if (r !== 'good' && r !== 'bad' && r !== 'problematic') return null
  const ratedAt = (uf as Record<string, unknown>).rated_at
  return {
    rating: r,
    rated_at: typeof ratedAt === 'string' ? ratedAt : new Date().toISOString()
  }
}

export interface InstanceLogCopyFeedbackBarProps {
  logId: string
  details: Record<string, unknown> | null | undefined
  textToCopy: string
  className?: string
  compact?: boolean
}

export function InstanceLogCopyFeedbackBar({
  logId,
  details,
  textToCopy,
  className,
  compact = false
}: InstanceLogCopyFeedbackBarProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const serverRating = readFeedback(details)?.rating ?? null
  const [localRating, setLocalRating] = useState<LogFeedbackRating | null>(serverRating)

  useEffect(() => {
    setLocalRating(serverRating)
  }, [serverRating, logId])

  const persistFeedback = useCallback(
    async (rating: LogFeedbackRating) => {
      if (logId.startsWith('temp-')) return
      setSaving(true)
      try {
        const supabase = createClient()
        const prev =
          details && typeof details === 'object' && !Array.isArray(details)
            ? { ...(details as Record<string, unknown>) }
            : {}
        const merged: Record<string, unknown> = {
          ...prev,
          user_feedback: {
            rating,
            rated_at: new Date().toISOString()
          }
        }
        const { error } = await supabase.from('instance_logs').update({ details: merged }).eq('id', logId)
        if (error) throw error
        setLocalRating(rating)
        toast({ title: 'Feedback saved' })
      } catch (e) {
        console.error('[InstanceLogCopyFeedbackBar]', e)
        toast({
          title: 'Could not save feedback',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive'
        })
      } finally {
        setSaving(false)
      }
    },
    [logId, details, toast]
  )

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(textToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  if (logId.startsWith('temp-')) {
    return null
  }

  const active = localRating
  const iconSize = compact ? 'h-3 w-3' : 'h-3.5 w-3.5'
  const boxSize = compact ? 'h-6 w-6' : 'h-7 w-7'

  const iconButtonClass = (isOn: boolean) =>
    cn(
      'inline-flex shrink-0 items-center justify-center rounded-md transition-colors',
      boxSize,
      isOn
        ? 'bg-primary/12 text-primary ring-1 ring-primary/25'
        : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground dark:text-foreground/75'
    )

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      onClick={e => e.stopPropagation()}
      role="toolbar"
      aria-label="Copy and rate this response"
    >
      <button
        type="button"
        onClick={handleCopy}
        className={cn(
          iconButtonClass(copied),
          copied &&
            'bg-green-500/10 text-green-600 ring-1 ring-green-500/25 hover:bg-green-500/15 dark:text-green-500'
        )}
        title={copied ? 'Copied' : 'Copy'}
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
      >
        {copied ? <Check className={iconSize} /> : <Copy className={iconSize} />}
      </button>

      <div className="h-3 w-px shrink-0 bg-border/80 dark:bg-border" aria-hidden />

      <button
        type="button"
        disabled={saving}
        onClick={e => {
          e.stopPropagation()
          void persistFeedback('good')
        }}
        className={iconButtonClass(active === 'good')}
        title="Good response"
        aria-label="Mark as good"
      >
        <ThumbsUp className={iconSize} />
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={e => {
          e.stopPropagation()
          void persistFeedback('bad')
        }}
        className={iconButtonClass(active === 'bad')}
        title="Bad response"
        aria-label="Mark as bad"
      >
        <ThumbsDown className={iconSize} />
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={e => {
          e.stopPropagation()
          void persistFeedback('problematic')
        }}
        className={iconButtonClass(active === 'problematic')}
        title="Problematic response"
        aria-label="Mark as problematic"
      >
        <AlertTriangle className={iconSize} />
      </button>
    </div>
  )
}
