import { ChatMessage } from "@/app/types/chat"

export type SenderProfile = {
  name: string
  avatar_url: string | null
}

export function getSenderInitials(name?: string | null, senderId?: string): string {
  const isFallbackName = !name || name.startsWith("Team Member (")
  if (!isFallbackName) {
    const initials = name
      .split(" ")
      .map((part) => part[0])
      .filter(Boolean)
      .join("")
      .substring(0, 2)
      .toUpperCase()
    if (initials) return initials
  }
  return senderId ? senderId.substring(0, 2).toUpperCase() : "T"
}

export function resolveTeamMemberSender(
  msg: Pick<ChatMessage, "sender_id" | "sender_name" | "sender_avatar">,
  options: {
    currentUserId?: string
    currentUserName?: string
    currentUserAvatar?: string
    userDataCache: Record<string, SenderProfile>
  }
): { name: string; avatar?: string; initials: string } {
  const { currentUserId, currentUserName, currentUserAvatar, userDataCache } = options
  const isCurrent = Boolean(msg.sender_id && msg.sender_id === currentUserId)
  const cached = msg.sender_id ? userDataCache[msg.sender_id] : undefined

  const name =
    msg.sender_name ||
    cached?.name ||
    (isCurrent ? currentUserName || "You" : undefined) ||
    (msg.sender_id ? `Team Member (${msg.sender_id.substring(0, 6)}...)` : "Team Member")

  const avatar =
    msg.sender_avatar ||
    cached?.avatar_url ||
    (isCurrent ? currentUserAvatar : undefined) ||
    undefined

  return {
    name,
    avatar: avatar || undefined,
    initials: getSenderInitials(name, msg.sender_id),
  }
}
