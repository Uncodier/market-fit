import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Users } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

export function RecordMemberAvatar({ name, src, compact, decorative, className }: {
  name?: string; src?: string | null; compact?: boolean; decorative?: boolean; className?: string
}) {
  const initials = name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("")
  const label = name || "Team member"
  return (
    <Avatar role={decorative ? undefined : "img"} aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : label} title={decorative ? undefined : label} className={cn(compact ? "size-5" : "size-6", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="text-[10px]" aria-hidden>
        {initials || <Users className="size-3.5" />}
      </AvatarFallback>
    </Avatar>
  )
}