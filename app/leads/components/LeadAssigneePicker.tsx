"use client"

import { useEffect, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandList } from "@/app/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { ChevronDown, Loader, Sparkles, Users } from "@/app/components/ui/icons"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { Lead } from "@/app/leads/types"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { assignLeadToUser } from "@/app/leads/actions"
import { siteMembersService } from "@/app/services/site-members-service"
import { assignableSiteMembers, type AssignableSiteMember } from "@/lib/auth/assignable-site-members"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function LeadAssigneePicker({
  lead,
  onAssigned,
}: {
  lead: Lead
  onAssigned: (assigneeId: string | null) => Promise<void>
}) {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [members, setMembers] = useState<AssignableSiteMember[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    if (!currentSite?.id) return
    let cancelled = false
    setLoading(true)
    siteMembersService
      .getMembers(currentSite.id)
      .then((list) => {
        if (cancelled) return
        setMembers(assignableSiteMembers(list))
      })
      .catch(() => toast.error("Failed to load team members"))
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentSite?.id])

  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  const options = [
    {
      id: "ai_team",
      name: "AI Team",
      email: null as string | null,
      isAITeam: true,
      isSelected: !lead.assignee_id,
      isCurrentUser: false,
    },
    ...members.map((member) => ({
      id: member.user_id,
      name: member.name || member.email,
      email: member.email,
      isAITeam: false,
      isSelected: lead.assignee_id === member.user_id,
      isCurrentUser: member.user_id === user?.id,
    })),
  ].filter((option) => !search || option.name.toLowerCase().includes(search.toLowerCase()))

  const selected = options.find((option) => option.isSelected)
  const label = selected?.isAITeam
    ? "AI Team"
    : selected?.isCurrentUser
      ? "You"
      : selected?.name || "AI Team"

  const assign = async (memberId: string | null) => {
    if (!currentSite?.id || assigning) return
    setAssigning(true)
    try {
      if (memberId) {
        const result = await assignLeadToUser(lead.id, memberId, currentSite.id)
        if (result.error) {
          toast.error(result.error)
          return
        }
      }
      await onAssigned(memberId)
      setOpen(false)
    } catch {
      toast.error("Failed to assign lead")
    } finally {
      setAssigning(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2 max-w-[180px]"
          disabled={loading || assigning}
        >
          {assigning ? (
            <Loader className="h-3.5 w-3.5" />
          ) : lead.assignee_id ? (
            <EntityAvatar name={label} className="h-5 w-5 text-[9px]" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Sparkles className="h-3 w-3" />
            </span>
          )}
          <span className="truncate text-xs">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search team members..." value={search} onValueChange={setSearch} />
          <CommandList>
            {options.length === 0 && (
              <CommandEmpty>
                <p className="text-sm text-muted-foreground py-4 text-center">No team members found.</p>
              </CommandEmpty>
            )}
            <CommandGroup>
              {loading ? (
                <div className="flex items-center px-2 py-1.5 text-sm text-muted-foreground">
                  <Loader className="h-4 w-4 mr-2" />
                  Loading...
                </div>
              ) : (
                options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={cn(
                      "flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent",
                      option.isSelected && "bg-accent/50"
                    )}
                    onClick={() => void assign(option.isAITeam ? null : option.id)}
                  >
                    {option.isAITeam ? (
                      <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                    ) : (
                      <EntityAvatar name={option.isCurrentUser ? "You" : option.name} className="h-6 w-6 text-[9px] mr-2" />
                    )}
                    <span className="truncate">
                      {option.isAITeam ? "AI Team" : option.isCurrentUser ? "You" : option.name}
                    </span>
                  </button>
                ))
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
