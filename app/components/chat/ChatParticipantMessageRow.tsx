import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { truncateLeadName } from "@/app/utils/name-utils"
import { resolveTeamMemberSender } from "./resolveTeamMemberSender"
import { ChatMessageContent } from "./chat-message-content"
import { MessageStatus, MessageTimestamp } from "./chat-message-status"
import {
  MessageIdentityContext,
  MessageRowActions,
  ProcessedChatMessage,
} from "./chat-message-types"
import { ChatMessageActionsBar } from "./ChatMessageActionsBar"

type ParticipantVariant =
  | "team-left"
  | "team-other"
  | "team-current"
  | "lead"
  | "visitor"

function senderColor(senderId?: string) {
  return senderId
    ? `hsl(${parseInt(senderId.replace(/[^a-f0-9]/gi, "").substring(0, 6), 16) % 360}, 70%, 65%)`
    : undefined
}

export function ChatParticipantMessageRow({
  message,
  variant,
  leadData,
  isDarkMode,
  identity,
  actions,
}: {
  message: ProcessedChatMessage
  variant: ParticipantVariant
  leadData: any
  isDarkMode: boolean
  identity: MessageIdentityContext
  actions: MessageRowActions
}) {
  const isTeam = variant.startsWith("team")
  const isLeft = variant === "team-left"
  const isOtherTeamMember = variant === "team-other"
  const teamSender = isTeam
    ? resolveTeamMemberSender(message, {
        currentUserId: identity.currentUserId,
        currentUserName: identity.currentUserName,
        currentUserAvatar: identity.currentUserAvatar,
        userDataCache: identity.userDataCache,
      })
    : null
  const leadName = leadData?.name || "Visitor"
  const displayName = teamSender?.name || truncateLeadName(leadName)
  const avatarAlt = teamSender?.name || leadName
  const avatar = teamSender?.avatar || leadData?.avatarUrl || undefined
  const initials =
    teamSender?.initials ||
    (leadData?.name
      ? leadData.name
          .split(" ")
          .map((part: string) => part[0])
          .join("")
          .substring(0, 2)
          .toUpperCase()
      : variant === "lead" && message.sender_id
        ? message.sender_id.substring(0, 2).toUpperCase()
        : "V")
  const displayedInitials =
    variant === "visitor" && leadData?.name
      ? leadData.name
          .split(" ")
          .map((part: string) => part[0])
          .join("")
          .substring(0, 2)
      : initials
  const isAccepted = message.metadata?.status === "accepted"

  const backgroundColor =
    message.metadata?.status === "pending"
      ? isDarkMode
        ? "#2a2a3a"
        : "#f8f8f8"
      : isOtherTeamMember && isAccepted
        ? isDarkMode
          ? "rgba(34, 197, 94, 0.1)"
          : "rgba(34, 197, 94, 0.05)"
        : isDarkMode
          ? "#2d2d3d"
          : "#f0f0f5"

  const avatarClass =
    variant === "lead" || variant === "visitor"
      ? "h-7 w-7 border border-amber-500/20"
      : variant === "team-current"
        ? "h-7 w-7 border border-primary/20"
        : "h-7 w-7 border border-primary/10"
  const fallbackClass =
    variant === "lead"
      ? "text-xs bg-amber-500/10 text-amber-600"
      : variant === "visitor"
        ? "bg-amber-500/10 text-amber-600"
        : variant === "team-current"
          ? "bg-primary/10 text-primary"
          : "text-xs bg-primary/10"
  const nameClass =
    variant === "lead" || variant === "visitor"
      ? "text-sm font-medium text-amber-600 dark:text-amber-500"
      : variant === "team-current"
        ? "text-sm font-medium text-primary"
        : "text-sm font-medium text-blue-600 dark:text-blue-400"

  return (
    <div
      className={`flex flex-col max-w-[85%] md:max-w-[75%] min-w-0 px-4 md:px-0 ${
        isLeft ? "" : "items-end"
      }`}
    >
      <div className={`flex flex-col min-w-0 group ${isLeft ? "" : "items-end"}`}>
        <div
          className={`flex items-center mb-1 gap-2 ${isLeft ? "" : "flex-row-reverse"}`}
        >
          <Avatar className={avatarClass}>
            <AvatarImage
              src={avatar}
              alt={avatarAlt}
              style={variant === "visitor" ? undefined : { objectFit: "cover" }}
            />
            <AvatarFallback
              className={fallbackClass}
              style={
                variant === "lead" || variant === "team-left" || variant === "team-other"
                  ? { backgroundColor: senderColor(message.sender_id) }
                  : undefined
              }
            >
              {displayedInitials}
            </AvatarFallback>
          </Avatar>
          <span className={nameClass}>{displayName}</span>
        </div>

        <div
          className={`rounded-lg p-4 transition-all duration-300 ease-in-out text-foreground ${
            isLeft ? "ml-9" : "mr-9"
          } min-w-0 overflow-hidden ${
            message.metadata?.status === "pending"
              ? "opacity-60"
              : isOtherTeamMember && isAccepted
                ? "border-2 border-green-500/30 bg-green-50/50 dark:bg-green-900/10"
                : ""
          }`}
          style={{
            backgroundColor,
            border:
              isOtherTeamMember && isAccepted
                ? "2px solid rgba(34, 197, 94, 0.3)"
                : "none",
            boxShadow: "none",
            outline: "none",
            filter: "none",
          }}
        >
          <ChatMessageContent message={message} />
          <div className="flex items-center justify-between mt-1.5">
            <MessageStatus
              message={message}
              onRetry={actions.onRetry}
              acceptedLabel={isOtherTeamMember ? "accepted" : "scheduled"}
            />
            <MessageTimestamp
              message={message}
              className={
                isOtherTeamMember || variant === "team-current" || variant === "visitor"
                  ? "text-xs opacity-70 text-right"
                  : undefined
              }
            />
          </div>
        </div>
      </div>
      <ChatMessageActionsBar message={message} actions={actions} />
    </div>
  )
}
