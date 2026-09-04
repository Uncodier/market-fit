import { useState, useEffect } from "react"
import { Label } from "@/app/components/ui/label"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { addDealContact, getDealById } from "@/app/deals/actions"
import { Deal } from "@/app/deals/types"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"

interface LinkContactDialogProps {
  deal: Deal
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onLinked: (deal: Deal) => void
}

export function LinkContactDialog({ deal, isOpen, onOpenChange, onLinked }: LinkContactDialogProps) {
  const { currentSite } = useSite()
  const [leadValue, setLeadValue] = useState<RelationSelectValue>(null)
  const [role, setRole] = useState("")
  const [isPrimary, setIsPrimary] = useState(false)
  const [isLinking, setIsLinking] = useState(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setLeadValue(null)
      setRole("")
      setIsPrimary(deal.contacts?.length === 0)
    }
  }, [isOpen, deal.contacts])

  // Fetch leads based on search term
  useEffect(() => {
    if (!currentSite?.id || !isOpen) return

    const fetchLeads = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        let query = supabase
          .from("leads")
          .select("id, name, email, position")
          .eq("site_id", currentSite.id)
          .order("created_at", { ascending: false })
          .limit(20)

        if (searchTerm) {
          query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        } else if (deal.company_id) {
          query = query.eq("company_id", deal.company_id)
        }

        const { data, error } = await query

        if (error) {
          console.error("Error fetching leads:", error)
        } else {
          setLeads(data || [])
        }
      } catch (err) {
        console.error("Failed to fetch leads:", err)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(() => {
      fetchLeads()
    }, 300)

    return () => clearTimeout(timer)
  }, [currentSite?.id, searchTerm, isOpen, deal.company_id])

  const handleLink = async () => {
    if (!leadValue || !currentSite) {
      toast.error("Please select a contact")
      return
    }

    setIsLinking(true)
    try {
      const { id: resolvedLeadId, error: resolveError } = await resolveRelationId("lead", leadValue, currentSite.id);
      if (resolveError || !resolvedLeadId) {
        throw new Error(resolveError || "Could not resolve lead");
      }

      const result = await addDealContact(deal.id, resolvedLeadId, role, isPrimary)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Contact linked successfully")
        
        // Fetch the updated deal to refresh the UI
        const updatedDealResult = await getDealById(deal.id)
        
        if (updatedDealResult.deal) {
          onLinked(updatedDealResult.deal)
        }
        onOpenChange(false)
      }
    } catch (error) {
      console.error("Failed to link contact:", error)
      toast.error("Failed to link contact")
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setSearchTerm("")
      }
      onOpenChange(open)
    }}>
      <DialogContent size="md" busy={isLinking}>
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Select a contact to link to this deal and specify their role.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-2">
            <Label>Contact</Label>
            <RelationSelect
              options={leads.map((l) => ({ id: l.id, label: l.name + (l.email ? ` (${l.email})` : "") }))}
              value={leadValue}
              onValueChange={setLeadValue}
              onSearchChange={setSearchTerm}
              placeholder="Select a contact..."
              emptyMessage="No contacts found"
            />
          </div>
          <div className="grid gap-2">
            <Label>Role in deal (optional)</Label>
            <Input
              className="h-12 text-base"
              placeholder="e.g. Decision Maker, Technical Evaluator..."
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isPrimary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="isPrimary" className="cursor-pointer font-medium">
              Primary contact for this deal
            </Label>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLinking}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={isLinking || !leadValue}>
            {isLinking ? "Adding..." : "Add contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
