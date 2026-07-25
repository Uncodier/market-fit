import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { addDealOwner, getDealById } from "@/app/deals/actions"
import { Deal } from "@/app/deals/types"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { siteMembersService, SiteMember } from "@/app/services/site-members-service"

interface LinkTeamMemberDialogProps {
  deal: Deal
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onLinked: (deal: Deal) => void
}

export function LinkTeamMemberDialog({ deal, isOpen, onOpenChange, onLinked }: LinkTeamMemberDialogProps) {
  const { currentSite } = useSite()
  const [userValue, setUserValue] = useState<RelationSelectValue>(null)
  const [isLinking, setIsLinking] = useState(false)

  const [members, setMembers] = useState<SiteMember[]>([])
  const [loading, setLoading] = useState(false)

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setUserValue(null)
    }
  }, [isOpen])

  // Fetch site members
  useEffect(() => {
    if (!currentSite?.id || !isOpen) return

    const fetchMembers = async () => {
      setLoading(true)
      try {
        const data = await siteMembersService.getMembers(currentSite.id)
        
        // Filter out members that are already linked, and must have a valid user_id
        const alreadyLinkedIds = deal.owners?.map(o => o.user_id) || []
        const availableMembers = data.filter(m => m.user_id && !alreadyLinkedIds.includes(m.user_id))
        
        setMembers(availableMembers)
      } catch (err) {
        console.error("Failed to fetch team members:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchMembers()
  }, [currentSite?.id, isOpen, deal.owners])


  const handleLink = async () => {
    if (!userValue || userValue.mode !== "existing") {
      toast.error("Please select a team member")
      return
    }

    setIsLinking(true)
    try {
      const result = await addDealOwner(deal.id, userValue.id)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Team member assigned successfully")
        
        // Fetch the updated deal to refresh the UI
        const updatedDealResult = await getDealById(deal.id)
        
        if (updatedDealResult.deal) {
          onLinked(updatedDealResult.deal)
        }
        onOpenChange(false)
      }
    } catch (error) {
      console.error("Failed to assign team member:", error)
      toast.error("Failed to assign team member")
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      onOpenChange(open)
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Assign Team Member</DialogTitle>
          <DialogDescription>
            Select a team member to assign to this deal.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Team Member</label>
            <RelationSelect
              options={members.map((m) => ({ id: m.user_id!, label: m.name || m.email || "Unknown" }))}
              value={userValue}
              onValueChange={setUserValue}
              allowCreate={false}
              placeholder="Select a team member..."
              emptyMessage="No team members found"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleLink} disabled={isLinking || !userValue}>
            {isLinking ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
