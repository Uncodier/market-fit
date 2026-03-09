import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { addDealOwner, getDealById } from "@/app/deals/actions"
import { Deal } from "@/app/deals/types"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandInput } from "@/app/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { Check, ChevronDown } from "@/app/components/ui/icons"
import { siteMembersService, SiteMember } from "@/app/services/site-members-service"

interface LinkTeamMemberDialogProps {
  deal: Deal
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onLinked: (deal: Deal) => void
}

export function LinkTeamMemberDialog({ deal, isOpen, onOpenChange, onLinked }: LinkTeamMemberDialogProps) {
  const { currentSite } = useSite()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [isLinking, setIsLinking] = useState(false)

  // Search state
  const [openCombobox, setOpenCombobox] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [members, setMembers] = useState<SiteMember[]>([])
  const [loading, setLoading] = useState(false)

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedUserId(null)
      setSearchTerm("")
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

  const filteredMembers = members.filter(m => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (m.name && m.name.toLowerCase().includes(term)) ||
      (m.email && m.email.toLowerCase().includes(term))
    )
  })

  const handleLink = async () => {
    if (!selectedUserId) {
      toast.error("Please select a team member")
      return
    }

    setIsLinking(true)
    try {
      const result = await addDealOwner(deal.id, selectedUserId)

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

  const selectedMember = members.find(m => m.user_id === selectedUserId)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        setSearchTerm("")
        setOpenCombobox(false)
      }
      onOpenChange(open)
    }}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => {
        if (openCombobox) {
          e.preventDefault()
        }
      }}>
        <DialogHeader>
          <DialogTitle>Assign Team Member</DialogTitle>
          <DialogDescription>
            Select a team member to assign to this deal.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Team Member</label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between h-12 text-base px-4 bg-background"
                >
                  {selectedUserId
                    ? selectedMember?.name || selectedMember?.email || "Unknown Member"
                    : "Select a team member..."}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                className="w-[460px] p-0 z-[100000]" 
                align="start"
              >
                <Command className="w-full" shouldFilter={false}>
                  <CommandInput
                    placeholder="Search members by name or email..."
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                  />
                  <CommandList className="max-h-[200px] overflow-y-auto">
                    {filteredMembers.length === 0 && !loading && (
                      <CommandEmpty>No team members found.</CommandEmpty>
                    )}
                    {loading && (
                      <CommandEmpty>Searching...</CommandEmpty>
                    )}
                    {filteredMembers.length > 0 && (
                      <CommandGroup>
                      {filteredMembers.map((member) => (
                        <div
                          key={member.id}
                          className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                          onClick={() => {
                            if (member.user_id) {
                              setSelectedUserId(member.user_id)
                              setOpenCombobox(false)
                            }
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedUserId === member.user_id ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          <div className="flex flex-col gap-1 py-1">
                            <span className="font-medium text-sm">{member.name || member.email}</span>
                            {member.name && member.email && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                {member.email}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleLink} disabled={isLinking || !selectedUserId}>
            {isLinking ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
