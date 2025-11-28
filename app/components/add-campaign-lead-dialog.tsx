"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { 
  PlusCircle, 
  User, 
  MessageSquare, 
  Globe,
  FileText,
  Phone,
  Tag
} from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/app/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"

interface AddCampaignLeadDialogProps {
  campaignId: string
  segments?: Array<{
    id: string
    name: string
  }>
  trigger?: React.ReactNode
  onLeadCreated?: () => void
}

export function AddCampaignLeadDialog({ campaignId, segments = [], trigger, onLeadCreated }: AddCampaignLeadDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [personalEmail, setPersonalEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [segmentId, setSegmentId] = useState("")
  const [status, setStatus] = useState<"new" | "contacted" | "qualified" | "converted" | "lost">("new")
  const [notes, setNotes] = useState("")
  const [origin, setOrigin] = useState("Campaign")
  const [error, setError] = useState<string | null>(null)
  const { currentSite } = useSite()

  const handleSubmit = async () => {
    // Validate site selection
    if (!currentSite?.id) {
      setError("Please select a site first")
      return
    }

    // Validate required fields
    if (!name || !email) {
      setError("Name and email are required fields")
      return
    }
    
    setIsLoading(true)
    setError(null)

    try {
      // Create Supabase client
      const supabase = await createClient()
      
      // Prepare lead data
      const leadData = {
        name, 
        email,
        personal_email: personalEmail || undefined,
        phone: phone || undefined,
        company: company ? { name: company } : null,
        position: position || undefined,
        segment_id: segmentId || undefined,
        status,
        notes: notes || undefined,
        origin: origin || undefined,
        site_id: currentSite.id,
        user_id: currentSite.user_id
      }
      
      // Insert the lead
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .insert([leadData])
        .select()
        .single()
      
      if (leadError) {
        throw new Error(`Error creating lead: ${leadError.message}`)
      }
      
      if (!lead || !lead.id) {
        throw new Error("Failed to create lead")
      }
      
      // Now update the lead with the campaign_id
      const { error: updateError } = await supabase
        .from("leads")
        .update({ campaign_id: campaignId })
        .eq("id", lead.id)
      
      if (updateError) {
        console.error("Error associating lead with campaign:", updateError)
        // We don't throw here as the lead was created successfully
      }
      
      // Clear form and close modal
      setName("")
      setEmail("")
      setPersonalEmail("")
      setPhone("")
      setCompany("")
      setPosition("")
      setSegmentId("")
      setStatus("new")
      setNotes("")
      setOrigin("Campaign")
      setIsOpen(false)
      
      toast.success("Lead added to campaign successfully")

      if (onLeadCreated) {
        onLeadCreated()
      }
    } catch (err) {
      console.error("Error creating lead:", err)
      setError(err instanceof Error ? err.message : "Error creating lead")
    } finally {
      setIsLoading(false)
    }
  }

  const statusOptions = [
    { value: "new", label: "New" },
    { value: "contacted", label: "Contacted" },
    { value: "qualified", label: "Qualified" },
    { value: "converted", label: "Converted" },
    { value: "lost", label: "Lost" }
  ]

  return (
    <Dialog 
      open={isOpen}
      modal={true}
      onOpenChange={(open) => {
        if (!isLoading) {
          setIsOpen(open)
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[550px]" 
        onEscapeKeyDown={(e) => {
          if (isLoading) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (isLoading) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (isLoading) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Add New Lead to Campaign</DialogTitle>
          <DialogDescription>
            Add a new lead to this campaign. Fill in the details below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-5 py-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Enter lead name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 pl-9"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="example@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 pl-9"
                  required
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="personalEmail" className="text-sm font-medium">
                Personal Email
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Input
                  id="personalEmail"
                  type="email"
                  placeholder="personal@example.com"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  className="h-12 pl-9"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-12 pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="company" className="text-sm font-medium">
                Company
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Input
                  id="company"
                  placeholder="Company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="h-12 pl-9"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="position" className="text-sm font-medium">
                Position
              </label>
              <div className="relative">
                <User className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Input
                  id="position"
                  placeholder="Job position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-12 pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="segment" className="text-sm font-medium">
                Segment
              </label>
              <div className="relative">
                <Select value={segmentId} onValueChange={setSegmentId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    {segments.length > 0 ? (
                      segments.map((segment) => (
                        <SelectItem key={segment.id} value={segment.id} className="py-2 px-1">
                          <div className="font-medium">{segment.name}</div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="py-2 px-4 text-sm text-muted-foreground">
                        No segments available
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="origin" className="text-sm font-medium">
                Origin
              </label>
              <div className="relative">
                <Tag className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Input
                  id="origin"
                  placeholder="Lead source or origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  className="h-12 pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="status" className="text-sm font-medium">
                Status
              </label>
              <div className="relative">
                <Select 
                  value={status} 
                  onValueChange={(value) => setStatus(value as "new" | "contacted" | "qualified" | "converted" | "lost")}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <label htmlFor="notes" className="text-sm font-medium">
              Notes
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Textarea
                id="notes"
                placeholder="Add any additional notes about this lead"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-[100px] pl-9 pt-2"
              />
            </div>
          </div>
        </div>
        
        <DialogFooter className="flex justify-between border-t pt-4">
          <Button 
            variant="outline" 
            onClick={() => {
              if (!isLoading) {
                setName("")
                setEmail("")
                setPersonalEmail("")
                setPhone("")
                setCompany("")
                setPosition("")
                setSegmentId("")
                setStatus("new")
                setNotes("")
                setOrigin("Campaign")
                setError(null)
                setIsOpen(false)
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || !name || !email}
          >
            {isLoading ? (
              <>
                <LoadingSkeleton variant="button" size="sm" className="text-white" />
                Creating...
              </>
            ) : (
              'Add Lead'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 