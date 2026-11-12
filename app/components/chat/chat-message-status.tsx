"use client"

import { useLocalization } from '@/app/context/LocalizationContext'
import { ChatMessage } from "@/app/types/chat"
import { isSocialCommentMetadata } from '@/lib/chat/social-comment-context'
import { isDeliveryRetryBlocked } from '@/lib/chat/response-format'
import { getTemplateDeliveryStatus } from '@/lib/chat/template-delivery'
import { getAudioDeliveryStatus } from '@/lib/chat/audio-delivery'
import * as Icons from "@/app/components/ui/icons"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"

const templateLabelKeys: Record<string, string> = {
  'Template read': 'chat.template.read',
  'Template delivered': 'chat.template.delivered',
  'Template delivery failed': 'chat.template.failed',
  'Template delivery unconfirmed': 'chat.template.unconfirmed',
  'Sent as template': 'chat.template.sent',
  'Sending template': 'chat.template.sending',
  'Template accepted': 'chat.template.accepted',
  'Pending template approval': 'chat.template.pendingApproval',
  'Template ready to send': 'chat.template.ready',
}

export function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function formatDate(date: Date, locale: string = 'en') {
  return date.toLocaleDateString(locale, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function getEstimatedSendTime(message: ChatMessage, locale: string) {
  if (!message.metadata?.delay_timer) return null

  const now = new Date()
  const nextHour = new Date(now)
  nextHour.setHours(now.getHours() + 1)
  nextHour.setMinutes(0, 0, 0)

  return nextHour.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

export function MessageTimestamp({
  message,
  className = "text-xs opacity-70",
  forceShowDate = false,
}: {
  message: ChatMessage
  className?: string
  forceShowDate?: boolean
}) {
  const { t, locale } = useLocalization()
  const messageDate = new Date(message.timestamp)
  const now = new Date()
  const showDate = forceShowDate || !isSameDay(messageDate, now)
  const templateStatus = getTemplateDeliveryStatus(message.metadata)
  const audioStatus = getAudioDeliveryStatus(message.metadata)
  const status = message.metadata?.status
  const deliveryLabel = templateStatus ? t(templateLabelKeys[templateStatus.label] ?? 'chat.template.unconfirmed')
    : audioStatus ? t(audioStatus.labelKey) : t(status === 'sent' ? 'chat.status.sent' : 'chat.status.delivered')
  const showCheck = templateStatus ? templateStatus.commandStatus === 'success'
    : audioStatus ? audioStatus.confirmed || audioStatus.labelKey === 'chat.status.sent'
      : status === 'sent' || status === 'delivered'
  const confirmedDelivery = audioStatus ? audioStatus.confirmed : status === 'delivered'

  return (
    <p className={`${className} inline-flex items-center gap-1 whitespace-nowrap shrink-0`}>
      {showDate && (
        <span className="mr-1">
          {messageDate.toLocaleDateString(locale, {
            month: "short",
            day: "numeric",
            year: messageDate.getFullYear() === now.getFullYear() ? undefined : "numeric",
          })}
        </span>
      )}
      {messageDate.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
      {showCheck && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={templateStatus || confirmedDelivery ? 'text-green-500' : 'text-amber-500'} aria-label={deliveryLabel}>
                <Icons.Check className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{deliveryLabel}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </p>
  )
}

export function MessageStatus({
  message,
  onRetry,
  acceptedLabel = "scheduled",
}: {
  message: ChatMessage
  onRetry?: (message: ChatMessage) => Promise<void>
  acceptedLabel?: "scheduled" | "accepted"
}) {
  const { t, locale } = useLocalization()
  const estimatedSendTime = getEstimatedSendTime(message, locale)
  const deliveryRetryBlocked = isDeliveryRetryBlocked(message.metadata)
  const templateStatus = getTemplateDeliveryStatus(message.metadata)
  const audioStatus = getAudioDeliveryStatus(message.metadata)
  const isCommentProposal = isSocialCommentMetadata(message.metadata) &&
    (message.role === 'assistant' || message.role === 'agent') && !message.metadata?.comment_delivery_status

  if (templateStatus) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span role="status" className={templateStatus.commandStatus === 'success' ? 'text-green-500'
          : templateStatus.commandStatus === 'failed' ? 'text-red-500' : 'text-amber-500'}>
          {t(templateLabelKeys[templateStatus.label] ?? 'chat.template.unconfirmed')}
        </span>
        {deliveryRetryBlocked && templateStatus.commandStatus !== 'success' && (
          <span className="text-muted-foreground">{t('chat.status.templateRetryUnavailable')}</span>
        )}
      </div>
    )
  }

  if (audioStatus && deliveryRetryBlocked) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span role="status" className={audioStatus.failed ? 'text-red-500' : audioStatus.confirmed ? 'text-green-500' : 'text-amber-500'}>
          {t(audioStatus.labelKey)}
        </span>
        {(audioStatus.failed || audioStatus.labelKey === 'chat.status.deliveryUnconfirmed' ||
          (!audioStatus.confirmed && message.metadata?.command_status === 'failed')) && (
          <span className="text-muted-foreground">{t('chat.status.audioCheckBeforeRetry')}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {(message.metadata?.status === "pending" || message.metadata?.status === "sending" || message.metadata?.status === "queued") && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center text-xs text-amber-500">
                <Icons.Clock className="h-3 w-3 mr-1" />
                {isCommentProposal ? t('chat.status.proposedReply') : estimatedSendTime ? t('chat.status.sendingAt', { time: estimatedSendTime }) : t('chat.status.sending')}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isCommentProposal ? t('chat.status.approvalHint') : t('chat.status.sendingHint')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {message.metadata?.status === "accepted" && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center text-xs text-green-500">
                <Icons.Check className="h-3 w-3 mr-1" />
                {acceptedLabel === "accepted"
                  ? t('chat.status.accepted')
                  : estimatedSendTime
                    ? t('chat.status.sendingAt', { time: estimatedSendTime })
                    : t('chat.status.accepted')}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {acceptedLabel === "accepted"
                  ? t('chat.status.acceptedHint')
                  : t('chat.status.scheduledHint')}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {deliveryRetryBlocked && message.metadata?.command_status === 'failed' && (
        <span className="text-xs text-amber-500">{t('chat.status.audioCheckBeforeRetry')}</span>
      )}
      {message.metadata?.command_status === "failed" && !deliveryRetryBlocked && (
        <>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center text-xs text-red-500">
                  <Icons.AlertCircle className="h-3 w-3 mr-1" />
                  {t('chat.status.failed')}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{message.metadata?.error_message || t('chat.status.failedHint')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {onRetry && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onRetry(message)}
                    className="inline-flex items-center text-xs text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-1 py-0.5 transition-colors"
                    type="button"
                  >
                    <Icons.RotateCcw className="h-3 w-3 mr-1" />
                    {t('chat.status.retry')}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('chat.status.retryHint')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      )}
    </div>
  )
}
