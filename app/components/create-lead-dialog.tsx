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
  Tag,
  Target
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

interface CreateLeadDialogProps {
  segments?: Array<{
    id: string
    name: string
  }>
  campaigns?: Array<{
    id: string
    title: string
    description?: string
  }>
  onCreateLead: (data: { 
    name: string
    email: string
    personal_email?: string
    phone?: string
    company?: string
    position?: string
    segment_id?: string
    campaign_id?: string
    status?: "new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified"
    notes?: string
    origin?: string
    site_id: string
  }) => Promise<{ error?: string; lead?: any }>
  trigger?: React.ReactNode
}

export function CreateLeadDialog({ onCreateLead, segments = [], campaigns = [], trigger }: CreateLeadDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [personalEmail, setPersonalEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [position, setPosition] = useState("")
  const [segmentId, setSegmentId] = useState("")
  const [campaignId, setCampaignId] = useState("")
  const [status, setStatus] = useState<"new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified">("new")
  const [notes, setNotes] = useState("")
  const [origin, setOrigin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const { currentSite } = useSite()

  const handleSubmit = async () => {
    // Validar que exista un sitio seleccionado
    if (!currentSite?.id) {
      setError("Please select a site first")
      return
    }

    // Validar campos requeridos
    if (!name || !email) {
      setError("Name and email are required fields")
      return
    }
    
    setIsLoading(true)
    setError(null)

    try {
      const result = await onCreateLead({ 
        name, 
        email,
        personal_email: personalEmail || undefined,
        phone: phone || undefined,
        company: company || undefined,
        position: position || undefined,
        segment_id: segmentId || undefined,
        campaign_id: campaignId === "none" ? undefined : campaignId || undefined,
        status,
        notes: notes || undefined,
        origin: origin || undefined,
        site_id: currentSite.id
      })
      
      if (result.error) {
        setError(result.error)
        return
      }
      
      // Limpiar el formulario y cerrar el modal
      setName("")
      setEmail("")
      setPersonalEmail("")
      setPhone("")
      setCompany("")
      setPosition("")
      setSegmentId("")
      setCampaignId("")
      setStatus("new")
      setNotes("")
      setOrigin("")
      setIsOpen(false)
      
      toast.success("Lead created successfully")
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
    { value: "cold", label: "Cold" },
    { value: "converted", label: "Converted" },
    { value: "lost", label: "Lost" },
    { value: "not_qualified", label: "Not Qualified" }
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
          <Button>
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
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Add a new lead to your database. Fill in the details below.
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
              <label htmlFor="campaign" className="text-sm font-medium">
                Campaign
              </label>
              <div className="relative">
                <Target className="absolute left-3 top-4 h-4 w-4 text-muted-foreground" />
                <Select value={campaignId} onValueChange={setCampaignId}>
                  <SelectTrigger className="h-12 pl-9">
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {campaigns.length > 0 ? (
                      campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id} className="py-2 px-1">
                          <div className="font-medium">{campaign.title}</div>
                        </SelectItem>
                      ))
                    ) : (
                      <div className="py-2 px-4 text-sm text-muted-foreground">
                        No campaigns available
                      </div>
                    )}
                  </SelectContent>
                </Select>
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
                setCampaignId("")
                setStatus("new")
                setNotes("")
                setOrigin("")
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