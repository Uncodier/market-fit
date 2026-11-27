import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Users } from "@/app/components/ui/icons"

export function RecordMemberAvatar({ name, src }: { name?: string; src?: string | null }) {
  const initials = name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join("")
  const label = name || "Team member"
  return (
    <Avatar role="img" aria-label={label} title={label} className="size-6">
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="text-[10px]" aria-hidden>
        {initials || <Users className="size-3.5" />}
      </AvatarFallback>
    </Avatar>
  )
}