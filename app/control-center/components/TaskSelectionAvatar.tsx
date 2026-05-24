"use client"

import { Avatar, AvatarFallback } from "@/app/components/ui/avatar"
import { Check } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

interface TaskSelectionAvatarProps {
  assigneeName?: string
  isSelected: boolean
  onToggle: (e: React.MouseEvent) => void
  size?: "sm" | "md"
}

const SIZE_CLASSES = {
  sm: "h-6 w-6",
  md: "h-[39px] w-[39px]",
}

const CHECK_ICON_SIZE = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
}

const getAssigneeInitials = (name?: string) => {
  if (!name) return ""
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("")
}

export function TaskSelectionAvatar({
  assigneeName,
  isSelected,
  onToggle,
  size = "md",
}: TaskSelectionAvatarProps) {
  const initials = getAssigneeInitials(assigneeName)

  return (
    <Avatar
      className={cn(
        SIZE_CLASSES[size],
        "flex-shrink-0 cursor-pointer border transition-all",
        isSelected
          ? "border-primary ring-2 ring-primary"
          : "border-primary/10 hover:ring-2 hover:ring-primary/20"
      )}
      onClick={onToggle}
    >
      <AvatarFallback
        className={cn(
          "text-xs transition-colors",
          isSelected
            ? "bg-primary text-primary-foreground"
            : initials
              ? "bg-primary/10"
              : "bg-muted/30 text-transparent"
        )}
      >
        {isSelected ? (
          <Check className={CHECK_ICON_SIZE[size]} />
        ) : (
          initials || " "
        )}
      </AvatarFallback>
    </Avatar>
  )
}
