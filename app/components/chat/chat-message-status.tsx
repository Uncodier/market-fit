import { ChatMessage } from "@/app/types/chat"
import * as Icons from "@/app/components/ui/icons"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"

export function isSameDay(date1: Date, date2: Date) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function getEstimatedSendTime(message: ChatMessage) {
  if (!message.metadata?.delay_timer) return null

  const now = new Date()
  const nextHour = new Date(now)
  nextHour.setHours(now.getHours() + 1)
  nextHour.setMinutes(0, 0, 0)

  return nextHour.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  })
}

function isDelivered(message: ChatMessage) {
  return (
    message.metadata?.status === "delivered" ||
    message.metadata?.status === "sent"
  )
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
  const messageDate = new Date(message.timestamp)
  const now = new Date()
  const showDate = forceShowDate || !isSameDay(messageDate, now)

  return (
    <p className={`${className} inline-flex items-center gap-1 whitespace-nowrap shrink-0`}>
      {showDate && (
        <span className="mr-1">
          {messageDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: messageDate.getFullYear() === now.getFullYear() ? undefined : "numeric",
          })}
        </span>
      )}
      {messageDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      {isDelivered(message) && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-green-500" aria-label="Delivered">
                <Icons.Check className="h-3 w-3" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Delivered</p>
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
  const estimatedSendTime = getEstimatedSendTime(message)

  return (
    <div className="flex items-center gap-2">
      {message.metadata?.status === "pending" && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center text-xs text-amber-500">
                <Icons.Clock className="h-3 w-3 mr-1" />
                {estimatedSendTime ? `Sending at ${estimatedSendTime}` : "Sending..."}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Message is being sent</p>
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
                  ? "Accepted"
                  : estimatedSendTime
                    ? `Sending at ${estimatedSendTime}`
                    : "Accepted"}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {acceptedLabel === "accepted"
                  ? "Message has been accepted"
                  : "Message accepted and scheduled"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {message.metadata?.command_status === "failed" && (
        <>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center text-xs text-red-500">
                  <Icons.AlertCircle className="h-3 w-3 mr-1" />
                  Failed to send
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{message.metadata?.error_message || "Message failed to reach the server"}</p>
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
                    Retry
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Retry sending this message</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </>
      )}
    </div>
  )
}
