"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/app/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu"
import {
  siteMembersService,
  type SiteMember,
} from "@/app/services/site-members-service"
import { getMemberInitials } from "@/app/components/settings/team-types"

type AuthUser = {
  id: string
  email?: string | null
  user_metadata?: {
    name?: string
    full_name?: string
    avatar_url?: string
    picture?: string
  }
}

type PosSellerSelectorProps = {
  siteId?: string
  user?: AuthUser | null
  value: string | null
  onValueChange?: (userId: string) => void
  onSellerChange?: (seller: { userId: string; name: string }) => void
}

function memberLabel(member: SiteMember) {
  return member.name?.trim() || member.email
}

export function PosSellerSelector({
  siteId,
  user,
  value,
  onValueChange,
  onSellerChange,
}: PosSellerSelectorProps) {
  const [members, setMembers] = useState<SiteMember[]>([])

  useEffect(() => {
    if (!siteId) {
      setMembers([])
      return
    }
    let cancelled = false
    void siteMembersService
      .getMembers(siteId)
      .then((rows) => {
        if (cancelled) return
        setMembers(
          rows.filter(
            (member) => member.status === "active" && Boolean(member.user_id),
          ),
        )
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error(error?.message || "Failed to load sellers")
        }
      })
    return () => {
      cancelled = true
    }
  }, [siteId])

  const selected = useMemo(
    () => members.find((member) => member.user_id === value) || null,
    [members, value],
  )
  const currentUserName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Current user"
  const selectedName = selected ? memberLabel(selected) : currentUserName
  const selectedEmail = selected?.email || user?.email || undefined
  const selectedAvatar =
    value === user?.id
      ? user.user_metadata?.avatar_url || user.user_metadata?.picture
      : undefined

  useEffect(() => {
    if (!selected?.user_id) return
    onSellerChange?.({
      userId: selected.user_id,
      name: memberLabel(selected),
    })
  }, [onSellerChange, selected])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full outline-none ring-offset-background transition-shadow hover:ring-2 hover:ring-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={`Seller: ${selectedName}`}
          title={`Seller: ${selectedName}`}
        >
          <Avatar className="h-9 w-9 border border-border/70">
            {selectedAvatar ? (
              <AvatarImage src={selectedAvatar} alt={selectedName} />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-xs text-primary">
              {getMemberInitials(selectedName, selectedEmail)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Select seller</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value || user?.id || ""}
          onValueChange={(userId) => {
            onValueChange?.(userId)
            const member = members.find((item) => item.user_id === userId)
            onSellerChange?.({
              userId,
              name: member ? memberLabel(member) : currentUserName,
            })
          }}
        >
          {members.map((member) => {
            const label = memberLabel(member)
            return (
              <DropdownMenuRadioItem
                key={member.id}
                value={member.user_id!}
                className="gap-2"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-muted text-[10px]">
                    {getMemberInitials(label, member.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate">{label}</span>
                  {member.position ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {member.position}
                    </span>
                  ) : null}
                </span>
              </DropdownMenuRadioItem>
            )
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
