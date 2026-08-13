"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { Plus, X } from "@/app/components/ui/icons"
import { Deal } from "@/app/deals/types"
import { getDealById, removeDealOwner } from "@/app/deals/actions"
import { LinkTeamMemberDialog } from "./LinkTeamMemberDialog"

export function DealTeamList({
  deal,
  onUpdate,
}: {
  deal: Deal
  onUpdate: (deal: Deal) => void
}) {
  const [assignOpen, setAssignOpen] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleRemove = async (userId: string) => {
    setRemovingId(userId)
    try {
      const result = await removeDealOwner(deal.id, userId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Team member removed")
      const updated = await getDealById(deal.id)
      if (updated.deal) onUpdate(updated.deal)
    } catch {
      toast.error("Failed to remove team member")
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">Owners</p>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setAssignOpen(true)}>
          <Plus className="h-3 w-3 mr-1" />
          Assign
        </Button>
      </div>

      {deal.owners && deal.owners.length > 0 ? (
        <div>
          {deal.owners.map((owner) => {
            const name = owner.user?.name || owner.user?.email || "Unknown member"
            return (
              <div key={owner.id} className="group flex items-center gap-2 py-1.5 min-w-0">
                <EntityAvatar name={name} className="h-6 w-6 text-[9px]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{name}</p>
                  {owner.user?.name && owner.user?.email && (
                    <p className="text-xs text-muted-foreground truncate">{owner.user.email}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  disabled={removingId === owner.user_id}
                  onClick={() => void handleRemove(owner.user_id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-2">No team members assigned.</p>
      )}

      <LinkTeamMemberDialog
        deal={deal}
        isOpen={assignOpen}
        onOpenChange={setAssignOpen}
        onLinked={onUpdate}
      />
    </div>
  )
}
