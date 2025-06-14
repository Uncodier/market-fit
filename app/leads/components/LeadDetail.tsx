import React, { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Badge } from "@/app/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import {
  User,
  MessageSquare,
  Phone,
  Globe,
  Tag,
  FileText,
  RotateCcw,
  CheckCircle2,
  X,
  Pencil,
  ExternalLink,
  Trash2
} from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Target } from "@/app/components/ui/target-icon"
import { 
  MapPin, 
  CalendarDays, 
  Bookmark, 
  Facebook, 
  Twitter, 
  Linkedin, 
  Instagram,
  TikTok,
  YouTube,
  WhatsApp,
  Pinterest
} from "./custom-icons"
import { Lead, STATUS_STYLES, Segment } from "@/app/leads/types"
import { Campaign } from "@/app/types"
import { toast } from "sonner"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/app/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/app/components/ui/alert-dialog"
import { DetailsTab } from "./DetailsTab"
import { CompanyTab } from "./CompanyTab"
import { SocialNetworkTab } from "./SocialNetworkTab"
import { AddressTab } from "./AddressTab"
import { NotesTab } from "./NotesTab"

interface LeadDetailProps {
  lead: Lead
  segments: Segment[]
  campaigns: Campaign[]
  onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void>
  onClose: () => void
  onDeleteLead?: (id: string) => Promise<void>
  hideStatus?: boolean
  onStatusChange?: (status: "new" | "contacted" | "qualified" | "converted" | "lost") => void
}

export function LeadDetail({ lead, segments, campaigns, onUpdateLead, onClose, onDeleteLead, hideStatus = false, onStatusChange }: LeadDetailProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [editForm, setEditForm] = useState<Omit<Lead, "id" | "created_at">>({
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    company_id: lead.company_id,
    company: lead.company || { 
      name: "", 
      website: "", 
      industry: "", 
      size: "",
      annual_revenue: "",
      founded: "",
      description: "",
      address: {
        street: "",
        city: "",
        state: "",
        zipcode: "",
        country: ""
      }
    },
    position: lead.position,
    segment_id: lead.segment_id,
    campaign_id: lead.campaign_id,
    status: lead.status,
    origin: lead.origin,
    birthday: lead.birthday || null,
    language: lead.language || null,
    social_networks: lead.social_networks || { 
      linkedin: "", 
      twitter: "", 
      facebook: "", 
      instagram: "",
      tiktok: "",
      youtube: "",
      whatsapp: "",
      pinterest: ""
    },
    address: lead.address || { street: "", city: "", state: "", zipcode: "", country: "" },
    notes: lead.notes || null,
    attribution: lead.attribution || null
  })
  
  // Función para obtener el nombre del segmento
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }
  
  // Función para obtener el nombre de la campaña
  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId) return "No Campaign"
    const campaign = campaigns.find(c => c.id === campaignId)
    return campaign?.title || "Unknown Campaign"
  }
  
  // Language mapping
  const LANGUAGES = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    pt: "Portuguese",
    it: "Italian",
    ru: "Russian",
    zh: "Chinese",
    ja: "Japanese"
  }
  
  // Función para obtener el nombre del idioma
  const getLanguageName = (languageCode: string | null) => {
    if (!languageCode) return null
    return LANGUAGES[languageCode as keyof typeof LANGUAGES] || languageCode
  }
  
  // Función para guardar los cambios
  const handleSaveChanges = async () => {
    setIsSaving(true)
    try {
      await onUpdateLead(lead.id, editForm)
      setIsEditing(false)
      toast.success("Lead updated successfully")
    } catch (error) {
      console.error("Error updating lead:", error)
      toast.error("Error updating lead")
    } finally {
      setIsSaving(false)
    }
  }

  // Función para eliminar el lead
  const handleDeleteLead = async () => {
    if (!onDeleteLead) return
    
    setIsDeleting(true)
    try {
      await onDeleteLead(lead.id)
      onClose() // Close the sheet after deletion
      toast.success("Lead deleted successfully")
    } catch (error) {
      console.error("Error deleting lead:", error)
      toast.error("Error deleting lead")
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleStatusChange = (value: "new" | "contacted" | "qualified" | "converted" | "lost") => {
    if (onStatusChange) {
      // Use custom status change handler if provided
      onStatusChange(value)
    } else {
      // Default behavior: update directly
      onUpdateLead(lead.id, { status: value })
    }
  }
  
  return (
    <div className="w-full p-6 overflow-auto h-full">
      {!hideStatus && (
        <div className="pb-6">
          {isEditing ? (
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-4" style={{ width: '48px', height: '48px' }}>
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Select 
                    value={editForm.status}
                    onValueChange={(value: "new" | "contacted" | "qualified" | "converted" | "lost") => 
                      setEditForm({...editForm, status: value})
                    }
                  >
                    <SelectTrigger className="h-12 text-sm">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mr-3" style={{ width: '48px', height: '48px' }}>
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Select 
                    value={lead.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="h-8 text-sm border-none p-0 shadow-none hover:bg-transparent focus:ring-0">
                      <Badge className={`text-xs ${STATUS_STYLES[lead.status]}`}>
                        {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Options Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <span className="text-base leading-none">⋮</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Lead
                  </DropdownMenuItem>
                  {onDeleteLead && (
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Lead
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      )}
      
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-5">
          {/* Contact Information with Tabs */}
          <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Contact Information
              </h3>
              
              {/* Options Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <span className="sr-only">Open menu</span>
                    <span className="text-base leading-none">⋮</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Lead
                  </DropdownMenuItem>
                  {onDeleteLead && (
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Lead
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <Tabs defaultValue="details" className="w-full">
              <div className="flex justify-center mb-4">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="company">Company</TabsTrigger>
                  <TabsTrigger value="social_networks">Social Networks</TabsTrigger>
                  <TabsTrigger value="address">Address</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
              </div>
              
              {/* Details Tab */}
              <TabsContent value="details" className="mt-0">
                <DetailsTab 
                  lead={lead}
                  segments={segments}
                  campaigns={campaigns}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                  getSegmentName={getSegmentName}
                  getCampaignName={getCampaignName}
                  getLanguageName={getLanguageName}
                />
              </TabsContent>
              
              {/* Company Tab */}
              <TabsContent value="company" className="mt-0">
                <CompanyTab 
                  lead={lead}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                />
              </TabsContent>
              
              {/* Social Networks Tab */}
              <TabsContent value="social_networks" className="mt-0">
                <SocialNetworkTab 
                  lead={lead}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                />
              </TabsContent>
              
              {/* Address Tab */}
              <TabsContent value="address" className="mt-0">
                <AddressTab 
                  lead={lead}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                />
              </TabsContent>
              
              {/* Notes Tab */}
              <TabsContent value="notes" className="mt-0">
                <NotesTab 
                  lead={lead}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            Creation Date
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-[5px]">Date</p>
                <p className="text-sm font-medium">
                  {new Date(lead.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                <RotateCcw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-[5px]">Time</p>
                <p className="text-sm font-medium">
                  {new Date(lead.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {isEditing && (
        <div className="flex items-center justify-end space-x-2 mt-6">
          <Button
            variant="outline"
            onClick={() => setIsEditing(false)}
            disabled={isSaving}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button 
            onClick={handleSaveChanges}
            disabled={isSaving}
          >
            {isSaving ? (
              <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the lead
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteLead}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Lead"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
} 