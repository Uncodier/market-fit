"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Badge } from "@/app/components/ui/badge"
import { Button } from "@/app/components/ui/button"
import { EntityAvatar } from "@/app/components/documents/document-list"
import { Plus, X } from "@/app/components/ui/icons"
import { Deal } from "@/app/deals/types"
import { getDealById, removeDealContact } from "@/app/deals/actions"
import { LinkContactDialog } from "./LinkContactDialog"

export function DealContactsList({
  deal,
  onUpdate,
}: {
  deal: Deal
  onUpdate: (deal: Deal) => void
}) {
  const [addOpen, setAddOpen] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const handleRemove = async (leadId: string) => {
    setRemovingId(leadId)
    try {
      const result = await removeDealContact(deal.id, leadId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Contact removed")
      const updated = await getDealById(deal.id)
      if (updated.deal) onUpdate(updated.deal)
    } catch {
      toast.error("Failed to remove contact")
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">Stakeholders</p>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="h-3 w-3 mr-1" />
          Add Contact
        </Button>
      </div>

      {deal.contacts && deal.contacts.length > 0 ? (
        <div>
          {deal.contacts.map((contact) => {
            const name = contact.lead?.name || "Unknown contact"
            const role = contact.role || contact.lead?.position
            const leadId = contact.lead?.id || contact.lead_id
            return (
              <div key={contact.id} className="group flex items-center gap-2 py-1.5 min-w-0">
                <EntityAvatar name={name} className="h-6 w-6 text-[9px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="text-sm truncate">{name}</p>
                    {contact.is_primary && (
                      <Badge variant="outline" className="h-4 px-1 text-[10px] font-normal">
                        Primary
                      </Badge>
                    )}
                  </div>
                  {role && <p className="text-xs text-muted-foreground truncate">{role}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  disabled={removingId === leadId}
                  onClick={() => void handleRemove(leadId)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-2">No contacts linked.</p>
      )}

      <LinkContactDialog
        deal={deal}
        isOpen={addOpen}
        onOpenChange={setAddOpen}
        onLinked={onUpdate}
      />
    </div>
  )
}
