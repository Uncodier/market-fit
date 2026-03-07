import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { addDealContact, getDealById } from "@/app/deals/actions"
import { Deal } from "@/app/deals/types"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { createClient } from "@/lib/supabase/client"
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/app/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import { Check, ChevronDown, User as UserIcon, Search } from "@/app/components/ui/icons"

interface LinkContactDialogProps {
  deal: Deal
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onLinked: (deal: Deal) => void
}

export function LinkContactDialog({ deal, isOpen, onOpenChange, onLinked }: LinkContactDialogProps) {
  const { currentSite } = useSite()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [role, setRole] = useState("")
  const [isPrimary, setIsPrimary] = useState(false)
  const [isLinking, setIsLinking] = useState(false)

  // Search state
  const [openCombobox, setOpenCombobox] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedLeadId(null)
      setRole("")
      setIsPrimary(deal.contacts?.length === 0)
      setSearchTerm("")
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
    if (!selectedLeadId) {
      toast.error("Please select a contact")
      return
    }

    setIsLinking(true)
    try {
      const result = await addDealContact(deal.id, selectedLeadId, role, isPrimary)

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

  const selectedLead = leads.find(l => l.id === selectedLeadId)

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Select a contact to link to this deal and specify their role.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Contact</label>
            <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openCombobox}
                  className="w-full justify-between h-12 text-base px-4"
                >
                  {selectedLeadId
                    ? selectedLead?.name || "Unknown Contact"
                    : "Select a contact..."}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[460px] p-0" align="start">
                <Command>
                  <div className="flex items-center border-b px-3">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                      className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder="Search contacts by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <CommandList>
                    <CommandEmpty>{loading ? "Searching..." : "No contacts found."}</CommandEmpty>
                    <CommandGroup>
                      {leads.map((lead) => (
                        <CommandItem
                          key={lead.id}
                          value={lead.name}
                          onSelect={() => {
                            setSelectedLeadId(lead.id)
                            setOpenCombobox(false)
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              selectedLeadId === lead.id ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          <div className="flex flex-col gap-1 py-1">
                            <span className="font-medium text-sm">{lead.name}</span>
                            {(lead.email || lead.position) && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                {lead.position ? <span>{lead.position}</span> : null}
                                {lead.position && lead.email ? <span>•</span> : null}
                                {lead.email ? <span>{lead.email}</span> : null}
                              </span>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2 mt-4">
            <label className="text-sm font-medium text-foreground">Role in Deal (Optional)</label>
            <Input 
              className="h-12 text-base"
              placeholder="e.g. Decision Maker, Technical Evaluator..."
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2 pt-4">
            <input 
              type="checkbox" 
              id="isPrimary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="isPrimary" className="text-sm font-medium cursor-pointer">
              Primary Contact for this deal
            </label>
          </div>
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLinking}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={isLinking || !selectedLeadId}>
            {isLinking ? "Adding..." : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
