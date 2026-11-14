"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Building } from "@/app/components/ui/icons"

export function CompanyLogo({ name, src }: { name: string; src?: string }) {
  return (
    <Avatar className="h-5 w-5 rounded-sm border border-border/40">
      {src ? <AvatarImage src={src} alt={`${name} logo`} /> : null}
      <AvatarFallback className="rounded-sm bg-muted text-muted-foreground" role="img" aria-label={`${name} logo unavailable`}>
        <Building className="h-3.5 w-3.5" aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  )
}