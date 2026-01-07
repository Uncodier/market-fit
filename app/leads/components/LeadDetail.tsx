import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Badge } from "@/app/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/app/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover"
import {
  User,
  MessageSquare,
  Phone,
  Globe,
  Tag,
  FileText,
  Loader,
  CheckCircle2,
  X,
  Pencil,
  ExternalLink,
  Trash2,
  Search,
  Mail,
  Users,
  ChevronDown,
  Home,
  Target
} from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
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
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { assignLeadToUser } from "@/app/leads/actions"
import { siteMembersService, SiteMember } from "@/app/services/site-members-service"
import { cn } from "@/lib/utils"
import { createConversation } from "@/app/services/chat-service"
import { createClient } from "@/utils/supabase/client"

// Type for active site members with guaranteed user_id
type ActiveSiteMember = SiteMember & { user_id: string }
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
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
  onStatusChange?: (status: "new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified") => void
}

export function LeadDetail({ lead, segments, campaigns, onUpdateLead, onClose, onDeleteLead, hideStatus = false, onStatusChange }: LeadDetailProps) {
  const { currentSite } = useSite()
  const { user } = useAuth()
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loadingActions, setLoadingActions] = useState<{ research: boolean; followup: boolean; newConversation: boolean; invalidation: boolean }>({
    research: false,
    followup: false,
    newConversation: false,
    invalidation: false
  })
  const [teamMembers, setTeamMembers] = useState<ActiveSiteMember[]>([])
  const [loadingTeamMembers, setLoadingTeamMembers] = useState(false)
  const [assigningLead, setAssigningLead] = useState(false)
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false)
  const [assigneeSearch, setAssigneeSearch] = useState("")
  
  // Create combined list with AI Team option + team members (same structure as CompanySelector)
  const allAssigneeOptions = [
    // AI Team option
    {
      id: 'ai_team',
      name: 'AI Team',
      email: null,
      position: null,
      isAITeam: true,
      isSelected: !lead.assignee_id,
      isCurrentUser: false
    },
    // Team members
    ...teamMembers.map(member => ({
      id: member.user_id,
      name: member.name || member.email,
      email: member.email,
      position: member.position,
      isAITeam: false,
      isSelected: lead.assignee_id === member.user_id,
      isCurrentUser: member.user_id === user?.id
    }))
  ]
  
  // Filter options based on search (same logic as CompanySelector)
  const filteredAssigneeOptions = allAssigneeOptions.filter(option => {
    if (!assigneeSearch) return true
    return option.name.toLowerCase().includes(assigneeSearch.toLowerCase())
  })

  const [editForm, setEditForm] = useState<Omit<Lead, "id" | "created_at">>({
    name: lead.name,
    email: lead.email,
    personal_email: lead.personal_email,
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
    attribution: lead.attribution || null,
    assignee_id: lead.assignee_id || null
  })

  // Load team members when component mounts
  useEffect(() => {
    if (currentSite?.id) {
      loadTeamMembers()
    }
  }, [currentSite?.id])

  // Clear search when dropdown closes
  useEffect(() => {
    if (!assigneeDropdownOpen) {
      setAssigneeSearch("")
    }
  }, [assigneeDropdownOpen])

  // Load team members function
  const loadTeamMembers = async () => {
    if (!currentSite?.id) return
    
    setLoadingTeamMembers(true)
    try {
      const members = await siteMembersService.getMembers(currentSite.id)
      // Only include active members who have user_id (are registered)
      const activeMembers = members.filter(member => member.status === 'active' && member.user_id) as ActiveSiteMember[]
      setTeamMembers(activeMembers)
    } catch (error) {
      console.error('Error loading team members:', error)
      toast.error('Failed to load team members')
    } finally {
      setLoadingTeamMembers(false)
    }
  }

  // Function to assign lead to a team member
  const handleAssignToMember = async (memberId: string) => {
    if (!currentSite?.id) {
      toast.error('No site selected')
      return
    }

    setAssigningLead(true)
    try {
      const result = await assignLeadToUser(lead.id, memberId, currentSite.id)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      toast.success('Lead assigned successfully')
      
      // Update the lead locally
      await onUpdateLead(lead.id, { assignee_id: memberId })
      
      // Update the edit form state
      setEditForm(prev => ({ ...prev, assignee_id: memberId }))
      
      setAssigneeDropdownOpen(false)
      setAssigneeSearch("") // Clear search when closing
    } catch (error) {
      console.error('Error assigning lead:', error)
      toast.error('Failed to assign lead')
    } finally {
      setAssigningLead(false)
    }
  }

  // Function to unassign lead
  const handleUnassignLead = async () => {
    if (!currentSite?.id) {
      toast.error('No site selected')
      return
    }

    setAssigningLead(true)
    try {
      // Unassign by setting assignee_id to null
      await onUpdateLead(lead.id, { assignee_id: null })
      
      toast.success('Lead unassigned successfully')
      
      // Update the edit form state
      setEditForm(prev => ({ ...prev, assignee_id: null }))
      
      setAssigneeDropdownOpen(false)
      setAssigneeSearch("") // Clear search when closing
    } catch (error) {
      console.error('Error unassigning lead:', error)
      toast.error('Failed to unassign lead')
    } finally {
      setAssigningLead(false)
    }
  }

  // Function to get assignee name
  const getAssigneeName = (assigneeId: string | null) => {
    if (!assigneeId) return 'AI Team'
    
    if (assigneeId === user?.id) return 'You'
    
    const member = teamMembers.find(m => m.user_id === assigneeId)
    return member?.name || member?.email || 'Team Member'
  }


  
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
  
  // Función para llamar API de research
  const handleLeadResearch = async () => {
    setLoadingActions(prev => ({ ...prev, research: true }))
    
    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const response = await apiClient.post('/api/workflow/leadResearch', {
        lead_id: lead.id,
        user_id: currentSite?.user_id,
        site_id: currentSite?.id
      })
      
      if (response.success) {
        toast.success("Lead research initiated successfully")
      } else {
        throw new Error(response.error?.message || 'Failed to initiate lead research')
      }
    } catch (error) {
      console.error('Error calling lead research API:', error)
      toast.error("Failed to initiate lead research")
    } finally {
      setLoadingActions(prev => ({ ...prev, research: false }))
    }
  }

  // Función para llamar API de follow up
  const handleLeadFollowUp = async () => {
    setLoadingActions(prev => ({ ...prev, followup: true }))
    
    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const response = await apiClient.post('/api/workflow/leadFollowUp', {
        lead_id: lead.id,
        user_id: currentSite?.user_id,
        site_id: currentSite?.id
      })
      
      if (response.success) {
        toast.success("Lead follow-up initiated successfully")
      } else {
        throw new Error(response.error?.message || 'Failed to initiate lead follow-up')
      }
    } catch (error) {
      console.error('Error calling lead follow-up API:', error)
      toast.error("Failed to initiate lead follow-up")
    } finally {
      setLoadingActions(prev => ({ ...prev, followup: false }))
    }
  }

  // Función para llamar API de lead invalidation
  const handleLeadInvalidation = async () => {
    setLoadingActions(prev => ({ ...prev, invalidation: true }))
    
    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const response = await apiClient.post('/api/workflow/leadInvalidation', {
        lead_id: lead.id,
        site_id: currentSite?.id
      })
      
      if (response.success) {
        toast.success("Lead invalidation initiated successfully")
      } else {
        throw new Error(response.error?.message || 'Failed to initiate lead invalidation')
      }
    } catch (error) {
      console.error('Error calling lead invalidation API:', error)
      toast.error("Failed to initiate lead invalidation")
    } finally {
      setLoadingActions(prev => ({ ...prev, invalidation: false }))
    }
  }

  // Function to create a new conversation with the Customer Support agent
  const handleNewConversation = async () => {
    if (!currentSite?.id || !user?.id) {
      toast.error('No site selected or user not authenticated')
      return
    }

    setLoadingActions(prev => ({ ...prev, newConversation: true }))
    try {
      const supabase = createClient()
      
      // Find the Customer Support agent for this site
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('id, name')
        .eq('site_id', currentSite.id)
        .eq('role', 'Customer Support')
        .single()

      if (agentError || !agent) {
        console.error('Customer Support agent not found:', agentError)
        toast.error('Customer Support agent not found for this site')
        return
      }

      // Create conversation with the Customer Support agent and lead
      const conversation = await createConversation(
        currentSite.id,
        user.id,
        agent.id,
        `Chat with ${lead.name}`,
        {
          lead_id: lead.id,
          channel: 'web'
        }
      )

      if (conversation) {
        toast.success('Conversation created successfully')
        // Navigate to chat with proper URL format
        const url = `/chat?conversationId=${conversation.id}&agentId=${agent.id}&agentName=${encodeURIComponent(agent.name)}`
        router.push(url)
      } else {
        toast.error('Failed to create conversation')
      }
    } catch (error) {
      console.error('Error creating conversation:', error)
      toast.error('Failed to create conversation')
    } finally {
      setLoadingActions(prev => ({ ...prev, newConversation: false }))
    }
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

  const handleStatusChange = (value: "new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified") => {
    if (onStatusChange) {
      // Use custom status change handler if provided
      onStatusChange(value)
    } else {
      // Default behavior: update directly
      onUpdateLead(lead.id, { status: value })
    }
  }
  
  return (
    <div className="w-full p-6 overflow-auto h-full min-w-0">
      {!hideStatus && (
        <div className="pb-6">
          {isEditing ? (
            <div className="mt-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mt-4" style={{ width: '48px', height: '48px' }}>
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Select 
                    value={editForm.status}
                    onValueChange={(value: "new" | "contacted" | "qualified" | "cold" | "converted" | "lost" | "not_qualified") => 
                      setEditForm({...editForm, status: value})
                    }
                  >
                    <SelectTrigger className="h-11 text-sm">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="cold">Cold</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="not_qualified">Not Qualified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center min-w-0 flex-1">
                <div className="bg-primary/10 rounded-md flex items-center justify-center mr-3" style={{ width: '48px', height: '48px' }}>
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Select 
                    value={lead.status}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="h-8 text-sm border-none p-0 shadow-none hover:bg-transparent focus:ring-0 max-w-full">
                      <Badge className={`text-xs ${STATUS_STYLES[lead.status]} truncate`}>
                        {lead.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </Badge>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="cold">Cold</SelectItem>
                      <SelectItem value="converted">Converted</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                      <SelectItem value="not_qualified">Not Qualified</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {/* Options Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                    <span className="sr-only">Open menu</span>
                    <span className="text-base leading-none">⋮</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={handleLeadResearch}
                    disabled={loadingActions.research}
                    className="flex items-center justify-between"
                  >
                    {loadingActions.research ? (
                      <Loader className="h-4 w-4" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-2">Lead Research</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleLeadFollowUp}
                    disabled={loadingActions.followup}
                    className="flex items-center justify-between"
                  >
                    {loadingActions.followup ? (
                      <Loader className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    <span className="ml-2">Lead Follow Up</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleLeadInvalidation}
                    disabled={loadingActions.invalidation}
                    className="flex items-center justify-between"
                  >
                    {loadingActions.invalidation ? (
                      <Loader className="h-4 w-4" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    <span className="ml-2">Lead Invalidation</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditing(true)} className="flex items-center justify-between">
                    <Pencil className="h-4 w-4" />
                    <span className="ml-2">Edit Lead</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleNewConversation}
                    disabled={loadingActions.newConversation}
                    className="flex items-center justify-between"
                  >
                    {loadingActions.newConversation ? (
                      <Loader className="h-4 w-4" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                    <span className="ml-2">New Conversation</span>
                  </DropdownMenuItem>
                  {onDeleteLead && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-red-600 flex items-center justify-between"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="ml-2">Delete Lead</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      )}
      
      <div className="space-y-6 min-w-0">
        <div className="grid grid-cols-1 gap-5">
          {/* Contact Information with Tabs */}
          <div className="bg-muted/40 rounded-lg p-4 border border-border/30 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider truncate flex-1 mr-2">
                Contact Information
              </h3>
              
              {/* Options Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                    <span className="sr-only">Open menu</span>
                    <span className="text-base leading-none">⋮</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={handleLeadResearch}
                    disabled={loadingActions.research}
                    className="flex items-center justify-between"
                  >
                    {loadingActions.research ? (
                      <Loader className="h-4 w-4" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-2">Lead Research</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleLeadFollowUp}
                    disabled={loadingActions.followup}
                    className="flex items-center justify-between"
                  >
                    {loadingActions.followup ? (
                      <Loader className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    <span className="ml-2">Lead Follow Up</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleLeadInvalidation}
                    disabled={loadingActions.invalidation}
                    className="flex items-center justify-between"
                  >
                    {loadingActions.invalidation ? (
                      <Loader className="h-4 w-4" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    <span className="ml-2">Lead Invalidation</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditing(true)} className="flex items-center justify-between">
                    <Pencil className="h-4 w-4" />
                    <span className="ml-2">Edit Lead</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={handleNewConversation}
                    disabled={loadingActions.newConversation}
                    className="flex items-center justify-between"
                  >
                    {loadingActions.newConversation ? (
                      <Loader className="h-4 w-4" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                    <span className="ml-2">New Conversation</span>
                  </DropdownMenuItem>
                  {onDeleteLead && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => setShowDeleteDialog(true)}
                        className="text-red-600 flex items-center justify-between"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="ml-2">Delete Lead</span>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <Tabs defaultValue="details" className="w-full min-w-0">
              <div className="flex justify-center mb-4 overflow-x-auto">
                <TabsList className="min-w-max">
                  <TabsTrigger value="details">
                    <User className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="company">
                    <Globe className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="social_networks">
                    <MessageSquare className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="address">
                    <Home className="w-4 h-4" />
                  </TabsTrigger>
                  <TabsTrigger value="notes">
                    <FileText className="w-4 h-4" />
                  </TabsTrigger>
                </TabsList>
              </div>
              
              {/* Details Tab */}
              <TabsContent value="details" className="mt-0 min-w-0">
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
              <TabsContent value="company" className="mt-0 min-w-0">
                <CompanyTab 
                  lead={lead}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                />
              </TabsContent>
              
              {/* Social Networks Tab */}
              <TabsContent value="social_networks" className="mt-0 min-w-0">
                <SocialNetworkTab 
                  lead={lead}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                />
              </TabsContent>
              
              {/* Address Tab */}
              <TabsContent value="address" className="mt-0 min-w-0">
                <AddressTab 
                  lead={lead}
                  isEditing={isEditing}
                  editForm={editForm}
                  setEditForm={setEditForm}
                />
              </TabsContent>
              
              {/* Notes Tab */}
              <TabsContent value="notes" className="mt-0 min-w-0">
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
        
        {/* Assignment Section */}
        <div className="bg-muted/40 rounded-lg p-4 border border-border/30 min-w-0">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider truncate">
            Assignment
          </h3>
          
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0" style={{ width: '48px', height: '48px' }}>
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-2">Assigned to</p>
              <Popover open={assigneeDropdownOpen} onOpenChange={setAssigneeDropdownOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={assigneeDropdownOpen}
                    className="w-full justify-between h-10"
                    disabled={loadingTeamMembers || assigningLead}
                  >
                    {assigningLead ? (
                      <div className="flex items-center">
                        <Loader className="h-4 w-4 mr-2" />
                        Assigning...
                      </div>
                    ) : (
                      <>
                        <span className="truncate">{getAssigneeName(lead.assignee_id || null)}</span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search team members..." 
                      value={assigneeSearch}
                      onValueChange={setAssigneeSearch}
                    />
                    <CommandList>
                      {filteredAssigneeOptions.length === 0 && (
                        <CommandEmpty>
                          <div className="text-center py-4">
                            <p className="text-sm text-muted-foreground">No team members found.</p>
                          </div>
                        </CommandEmpty>
                      )}
                      <CommandGroup>
                        {loadingTeamMembers ? (
                          <div className="relative flex select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none opacity-50">
                            <Loader className="h-4 w-4 mr-2" />
                            Loading...
                          </div>
                        ) : (
                          filteredAssigneeOptions.map((option) => (
                            <div
                              key={option.id}
                              className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                option.isSelected && "bg-accent/50 text-accent-foreground"
                              )}
                              onClick={() => !assigningLead && (
                                option.isAITeam 
                                  ? handleUnassignLead()
                                  : handleAssignToMember(option.id)
                              )}
                            >
                              {/* Removed check icon - selection indicated by background color */}
                              <div className="flex-1">
                                <p className="font-medium">
                                  {option.isAITeam 
                                    ? 'AI Team' 
                                    : (option.isCurrentUser ? 'You' : option.name)
                                  }
                                </p>
                                {!option.isAITeam && option.name !== option.email && option.email && (
                                  <p className="text-xs text-muted-foreground">{option.email}</p>
                                )}
                                {!option.isAITeam && option.position && (
                                  <p className="text-xs text-muted-foreground">{option.position}</p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        
        <div className="bg-muted/40 rounded-lg p-4 border border-border/30 min-w-0">
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider truncate">
            Creation Date
          </h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-[5px]">Date</p>
                <p className="text-sm font-medium truncate">
                  {new Date(lead.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px] flex-shrink-0" style={{ width: '48px', height: '48px' }}>
                <Loader className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground mb-[5px]">Time</p>
                <p className="text-sm font-medium truncate">
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
              <Loader className="mr-2 h-4 w-4" />
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