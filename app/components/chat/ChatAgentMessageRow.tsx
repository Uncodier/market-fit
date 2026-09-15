import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { truncateAgentName } from "@/app/utils/name-utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"
import * as Icons from "@/app/components/ui/icons"
import { DelayTimer } from "./DelayTimer"
import { ChatResponseActions } from "./ChatResponseActions"
import { ChatMessageContent } from "./chat-message-content"
import { MessageTimestamp } from "./chat-message-status"
import {
  MessageIdentityContext,
  MessageRowActions,
  ProcessedChatMessage,
} from "./chat-message-types"
import { ChatMessageActionsBar } from "./ChatMessageActionsBar"

function getEstimatedSendTime(message: ProcessedChatMessage) {
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

export function ChatAgentMessageRow({
  message,
  index,
  agentId,
  agentName,
  siteId,
  conversationId,
  responsePrompt,
  hasAssignee,
  leadData,
  isDarkMode,
  identity,
  actions,
}: {
  message: ProcessedChatMessage
  index: number
  agentId: string
  agentName: string
  siteId?: string
  conversationId?: string
  responsePrompt?: string
  hasAssignee: boolean
  leadData: any
  isDarkMode: boolean
  identity: MessageIdentityContext
  actions: MessageRowActions
}) {
  const isAssignee = hasAssignee && message.sender_id === leadData?.assignee?.id
  const senderName = isAssignee
    ? leadData.assignee.name
    : (message.agent_id && identity.agentDataCache[message.agent_id]?.name) || agentName
  const estimatedSendTime = getEstimatedSendTime(message)

  return (
    <div className="max-w-[85%] md:max-w-[75%] min-w-0 group px-4 md:px-0">
      <div className="flex items-center mb-1 gap-2">
        <div className="relative">
          <Avatar
            className={`h-7 w-7 border ${
              isAssignee ? "border-blue-500/20" : "border-primary/10"
            }`}
          >
            <AvatarImage
              src={isAssignee ? leadData.assignee.avatar_url || undefined : undefined}
              alt={senderName}
            />
            <AvatarFallback
              className={
                isAssignee ? "bg-blue-500/10 text-blue-600" : "bg-primary/10"
              }
            >
              {senderName
                .split(" ")
                .map((part: string) => part[0])
                .join("")
                .substring(0, 2)}
            </AvatarFallback>
          </Avatar>
          {message.metadata?.status === "pending" &&
            (message.metadata?.delay_timer ||
              message.metadata?.custom_data?.delay_timer) && (
              <DelayTimer
                delayTimer={
                  message.metadata.delay_timer ||
                  message.metadata.custom_data.delay_timer
                }
                className="absolute -inset-0.5"
                size={32}
              />
            )}
        </div>
        <span
          className={`text-sm font-medium ${
            isAssignee ? "text-blue-600 dark:text-blue-400" : "text-primary"
          }`}
        >
          {truncateAgentName(senderName)}
        </span>
      </div>

      <div
        className={`ml-9 transition-all duration-300 ease-in-out ${
          message.metadata?.status === "pending" ||
          message.metadata?.status === "accepted"
            ? "rounded-lg p-4"
            : ""
        } ${
          message.metadata?.status === "pending"
            ? "opacity-60"
            : message.metadata?.status === "accepted"
              ? "border-2 border-green-500/30 bg-green-50/50 dark:bg-green-900/10"
              : ""
        }`}
        style={
          message.metadata?.status === "pending" ||
          message.metadata?.status === "accepted"
            ? {
                backgroundColor:
                  message.metadata?.status === "pending"
                    ? isDarkMode
                      ? "#2a2a3a"
                      : "#f8f8f8"
                    : isDarkMode
                      ? "rgba(34, 197, 94, 0.1)"
                      : "rgba(34, 197, 94, 0.05)",
                border:
                  message.metadata?.status === "accepted"
                    ? "2px solid rgba(34, 197, 94, 0.3)"
                    : "none",
              }
            : undefined
        }
      >
        <ChatMessageContent message={message} />
        <div className="flex items-center justify-between gap-2 mt-2">
          <div className="flex items-center min-w-0">
            <ChatResponseActions
              messageId={String(message.id || index)}
              commandId={message.command_id}
              agentId={agentId}
              siteId={siteId}
              conversationId={conversationId}
              userPrompt={responsePrompt}
              response={message.text}
            />
          </div>
          <div className="flex items-center justify-end shrink-0">
            {message.metadata?.status === "pending" ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center text-xs text-amber-500">
                      <Icons.Clock className="h-3 w-3 mr-1" />
                      {estimatedSendTime
                        ? `Sending at ${estimatedSendTime}`
                        : "Sending..."}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Message is being sent</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : message.metadata?.status === "accepted" ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center text-xs text-green-500">
                      <Icons.Check className="h-3 w-3 mr-1" />
                      {estimatedSendTime ? `Sending at ${estimatedSendTime}` : "Accepted"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Message accepted and scheduled</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <MessageTimestamp
                message={message}
                className="text-xs opacity-70 text-right"
                forceShowDate
              />
            )}
          </div>
        </div>
        {message.command_id && (
          <div className="text-xs text-muted-foreground mt-1 hidden">
            Command ID: {message.command_id}
          </div>
        )}
      </div>
      <ChatMessageActionsBar message={message} actions={actions} />
    </div>
  )
}
