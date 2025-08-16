import React, { useState, useEffect, useMemo } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { ChevronDown, ChevronRight, ChevronLeft, Search, Users, MessageSquare, Globe, FileText, Loader, Tag, X, CheckCircle2, ExternalLink, Phone, Pencil, Mail, Filter, MoreHorizontal, Trash2 } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Pagination } from "@/app/components/ui/pagination"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"
import { useAuth } from "@/app/hooks/use-auth"
import { Sparkles, User as UserIcon } from "@/app/components/ui/icons"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/app/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/components/ui/alert-dialog"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { assignLeadToUser, updateLead } from "@/app/leads/actions"
import { createClient } from "@/utils/supabase/client"
import { createConversation } from "@/app/services/chat-service"
import { toast } from "sonner"
import { Lead } from "@/app/leads/types"
import { useRouter } from "next/navigation"

// Colores para las etapas del journey
const JOURNEY_STAGE_COLORS: Record<string, string> = {
  awareness: 'bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200',
  consideration: 'bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200',
  decision: 'bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200',
  purchase: 'bg-green-50 text-green-700 hover:bg-green-50 border-green-200',
  retention: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-indigo-200',
  referral: 'bg-pink-50 text-pink-700 hover:bg-pink-50 border-pink-200',
  not_contacted: 'bg-gray-50 text-gray-700 hover:bg-gray-50 border-gray-200'
}

const JOURNEY_STAGES = [
  { id: 'awareness', label: 'Awareness' },
  { id: 'consideration', label: 'Consideration' },
  { id: 'decision', label: 'Decision' },
  { id: 'purchase', label: 'Purchase' },
  { id: 'retention', label: 'Retention' },
  { id: 'referral', label: 'Referral' }
]

// Obtener el nombre legible de una etapa
const getJourneyStageName = (stageId: string) => {
  if (stageId === "not_contacted") return "Unaware"
  return JOURNEY_STAGES.find(stage => stage.id === stageId)?.label || "Unknown"
}

// Interfaz para representar una empresa agrupada
interface CompanyGroup {
  companyName: string
  companyKey: string
  leads: Lead[]
  mostAdvancedLead: Lead
  mostAdvancedStage: string
  leadCount: number
  isExpanded: boolean
}

interface GroupedLeadsTableProps {
  companyGroups: CompanyGroup[]
  currentPage: number
  itemsPerPage: number
  totalLeads: number
  totalCompanies: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onLeadClick: (lead: Lead) => void
  forceReload: number
  invalidateJourneyStageCache: (leadId: string) => void
  onUpdateLead?: (leadId: string, updates: Partial<Lead> & { invalidated?: boolean }) => void
  onDeleteLead?: (leadId: string) => Promise<void>
  userData: Record<string, { name: string, avatar_url: string | null }>
  onToggleCompanyExpansion: (companyKey: string) => void
  segments: Array<{ id: string; name: string }>
  leadJourneyStages: Record<string, string>
  isLoadingJourneyStages: boolean
  reloadingLeads: Set<string>
}

export function GroupedLeadsTable({
  companyGroups,
  currentPage,
  itemsPerPage,
  totalLeads,
  totalCompanies,
  onPageChange,
  onItemsPerPageChange,
  onLeadClick,
  forceReload,
  invalidateJourneyStageCache,
  onUpdateLead,
  onDeleteLead,
  userData,
  onToggleCompanyExpansion,
  segments,
  leadJourneyStages,
  isLoadingJourneyStages,
  reloadingLeads
}: GroupedLeadsTableProps) {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalCompanies / itemsPerPage)
  const { currentSite } = useSite()
  const { user } = useAuth()
  const router = useRouter()
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [loadingActions, setLoadingActions] = useState<Record<string, 'research' | 'followup' | 'invalidation' | 'newConversation' | null>>({})
  const [successActions, setSuccessActions] = useState<Record<string, 'research' | 'followup' | 'invalidation' | 'newConversation' | null>>({})
  const [assigningLeads, setAssigningLeads] = useState<Record<string, boolean>>({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null)
  const [isDeletingLead, setIsDeletingLead] = useState(false)

  // Función para llamar API de research
  const handleLeadResearch = async (leadId: string, isBulk: boolean = false, allLeads?: Lead[]) => {
    const leadsToProcess = isBulk && allLeads ? allLeads : [{ id: leadId }]
    
    // Marcar todos los leads como loading
    leadsToProcess.forEach(lead => {
      setLoadingActions(prev => ({ ...prev, [lead.id]: 'research' }))
    })
    
    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const results = await Promise.all(
        leadsToProcess.map(async (lead) => {
          try {
            const response = await apiClient.post('/api/workflow/leadResearch', {
              lead_id: lead.id,
              user_id: currentSite?.user_id,
              site_id: currentSite?.id
            })
            
            if (response.success) {
              setSuccessActions(prev => ({ ...prev, [lead.id]: 'research' }))
              setTimeout(() => {
                setSuccessActions(prev => ({ ...prev, [lead.id]: null }))
              }, 2000)
              
              setTimeout(() => {
                invalidateJourneyStageCache(lead.id)
              }, 1000)
              
              setTimeout(() => {
                invalidateJourneyStageCache(lead.id)
              }, 5000)
              
              return { success: true, leadId: lead.id }
            } else {
              throw new Error(response.error?.message || 'Failed to initiate lead research')
            }
          } catch (error) {
            console.error(`Error calling lead research API for lead ${lead.id}:`, error)
            return { success: false, leadId: lead.id, error }
          }
        })
      )
      
      const failedCount = results.filter(r => !r.success).length
      const successCount = results.length - failedCount
      
      if (successCount > 0) {
        toast.success(`Lead research initiated for ${successCount} lead${successCount > 1 ? 's' : ''} successfully`)
      }
      
      if (failedCount > 0) {
        toast.error(`Failed to initiate research for ${failedCount} lead${failedCount > 1 ? 's' : ''}`)
      }
      
    } catch (error) {
      console.error('Error calling lead research API:', error)
      toast.error("Failed to initiate lead research")
    } finally {
      // Limpiar loading state
      leadsToProcess.forEach(lead => {
        setLoadingActions(prev => ({ ...prev, [lead.id]: null }))
      })
    }
  }

  // Función para llamar API de follow up
  const handleLeadFollowUp = async (leadId: string, isBulk: boolean = false, allLeads?: Lead[]) => {
    const leadsToProcess = isBulk && allLeads ? allLeads : [{ id: leadId }]
    
    // Marcar todos los leads como loading
    leadsToProcess.forEach(lead => {
      setLoadingActions(prev => ({ ...prev, [lead.id]: 'followup' }))
    })
    
    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const results = await Promise.all(
        leadsToProcess.map(async (lead) => {
          try {
            const response = await apiClient.post('/api/workflow/leadFollowUp', {
              lead_id: lead.id,
              user_id: currentSite?.user_id,
              site_id: currentSite?.id
            })
            
            if (response.success) {
              setSuccessActions(prev => ({ ...prev, [lead.id]: 'followup' }))
              setTimeout(() => {
                setSuccessActions(prev => ({ ...prev, [lead.id]: null }))
              }, 2000)
              
              setTimeout(() => {
                invalidateJourneyStageCache(lead.id)
              }, 1000)
              
              setTimeout(() => {
                invalidateJourneyStageCache(lead.id)
              }, 5000)
              
              return { success: true, leadId: lead.id }
            } else {
              throw new Error(response.error?.message || 'Failed to initiate lead follow-up')
            }
          } catch (error) {
            console.error(`Error calling lead follow-up API for lead ${lead.id}:`, error)
            return { success: false, leadId: lead.id, error }
          }
        })
      )
      
      const failedCount = results.filter(r => !r.success).length
      const successCount = results.length - failedCount
      
      if (successCount > 0) {
        toast.success(`Lead follow-up initiated for ${successCount} lead${successCount > 1 ? 's' : ''} successfully`)
      }
      
      if (failedCount > 0) {
        toast.error(`Failed to initiate follow-up for ${failedCount} lead${failedCount > 1 ? 's' : ''}`)
      }
      
    } catch (error) {
      console.error('Error calling lead follow-up API:', error)
      toast.error("Failed to initiate lead follow-up")
    } finally {
      // Limpiar loading state
      leadsToProcess.forEach(lead => {
        setLoadingActions(prev => ({ ...prev, [lead.id]: null }))
      })
    }
  }

  // Función para asignar un lead al usuario actual
  const handleAssignLead = async (leadId: string, isBulk: boolean = false, allLeads?: Lead[]) => {
    if (!user?.id || !currentSite?.id) {
      toast.error("User not authenticated or site not selected")
      return
    }

    const leadsToProcess = isBulk && allLeads ? allLeads : [{ id: leadId }]
    
    // Marcar todos los leads como loading
    leadsToProcess.forEach(lead => {
      setAssigningLeads(prev => ({ ...prev, [lead.id]: true }))
    })
    
    try {
      const results = await Promise.all(
        leadsToProcess.map(async (lead) => {
          const result = await assignLeadToUser(lead.id, user.id, currentSite.id)
          if (!result.error) {
            onUpdateLead?.(lead.id, { assignee_id: user.id })
            invalidateJourneyStageCache(lead.id)
          }
          return result
        })
      )
      
      const failedCount = results.filter(r => r.error).length
      const successCount = results.length - failedCount
      
      if (successCount > 0) {
        toast.success(`${successCount} lead${successCount > 1 ? 's' : ''} assigned successfully`)
      }
      
      if (failedCount > 0) {
        toast.error(`Failed to assign ${failedCount} lead${failedCount > 1 ? 's' : ''}`)
      }
      
    } catch (error) {
      console.error('Error assigning leads:', error)
      toast.error("Failed to assign leads")
    } finally {
      // Limpiar loading state
      leadsToProcess.forEach(lead => {
        setAssigningLeads(prev => ({ ...prev, [lead.id]: false }))
      })
    }
  }

  // Función para llamar API de invalidation
  const handleLeadInvalidation = async (leadId: string, isBulk: boolean = false, allLeads?: Lead[]) => {
    const leadsToProcess = isBulk && allLeads ? allLeads : [{ id: leadId }]
    
    // Marcar todos los leads como loading
    leadsToProcess.forEach(lead => {
      setLoadingActions(prev => ({ ...prev, [lead.id]: 'invalidation' }))
    })
    
    try {
      const { apiClient } = await import('@/app/services/api-client-service')
      
      const results = await Promise.all(
        leadsToProcess.map(async (lead) => {
          try {
            const response = await apiClient.post('/api/workflow/leadInvalidation', {
              lead_id: lead.id,
              site_id: currentSite?.id
            })
            
            if (response.success) {
              setSuccessActions(prev => ({ ...prev, [lead.id]: 'invalidation' }))
              setTimeout(() => {
                setSuccessActions(prev => ({ ...prev, [lead.id]: null }))
              }, 2000)
              
              setTimeout(() => {
                invalidateJourneyStageCache(lead.id)
              }, 1000)
              
              setTimeout(() => {
                invalidateJourneyStageCache(lead.id)
              }, 5000)
              
              return { success: true, leadId: lead.id }
            } else {
              throw new Error(response.error?.message || 'Failed to initiate lead invalidation')
            }
          } catch (error) {
            console.error(`Error calling lead invalidation API for lead ${lead.id}:`, error)
            return { success: false, leadId: lead.id, error }
          }
        })
      )
      
      const failedCount = results.filter(r => !r.success).length
      const successCount = results.length - failedCount
      
      if (successCount > 0) {
        toast.success(`Lead invalidation initiated for ${successCount} lead${successCount > 1 ? 's' : ''} successfully`)
        
        // Remover los leads invalidados exitosamente del estado local
        const successfulLeadIds = results.filter(r => r.success).map(r => r.leadId)
        successfulLeadIds.forEach(leadId => {
          // Usar setTimeout para dar tiempo a que se muestre el estado de éxito
          setTimeout(() => {
            // Eliminar el lead del estado usando la función onUpdateLead con un status especial
            // o notificar al componente padre que debe remover el lead
            if (onUpdateLead) {
              // Marcar como invalidado para que el componente padre lo filtre
              onUpdateLead(leadId, { invalidated: true })
            }
          }, 2500) // Esperar 2.5 segundos para que el usuario vea el éxito
        })
      }
      
      if (failedCount > 0) {
        toast.error(`Failed to initiate invalidation for ${failedCount} lead${failedCount > 1 ? 's' : ''}`)
      }
      
    } catch (error) {
      console.error('Error calling lead invalidation API:', error)
      toast.error("Failed to initiate lead invalidation")
    } finally {
      // Limpiar loading state
      leadsToProcess.forEach(lead => {
        setLoadingActions(prev => ({ ...prev, [lead.id]: null }))
      })
    }
  }

  // Función para crear nueva conversación
  const handleNewConversation = async (leadId: string) => {
    if (!currentSite?.id || !user?.id) {
      toast.error('No site selected or user not authenticated')
      return
    }

    setLoadingActions(prev => ({ ...prev, [leadId]: 'newConversation' }))
    
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

      // Get lead details
      const lead = companyGroups
        .flatMap(group => group.leads)
        .find(l => l.id === leadId)
      
      if (!lead) {
        toast.error('Lead not found')
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
        setSuccessActions(prev => ({ ...prev, [leadId]: 'newConversation' }))
        setTimeout(() => {
          setSuccessActions(prev => ({ ...prev, [leadId]: null }))
        }, 2000)
        
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
      setLoadingActions(prev => ({ ...prev, [leadId]: null }))
    }
  }

  // Función para eliminar lead
  const handleDeleteLead = async (lead: Lead) => {
    setLeadToDelete(lead)
    setShowDeleteDialog(true)
  }

  const confirmDeleteLead = async () => {
    if (!leadToDelete || !onDeleteLead) return
    
    setIsDeletingLead(true)
    try {
      await onDeleteLead(leadToDelete.id)
      setShowDeleteDialog(false)
      setLeadToDelete(null)
      toast.success("Lead deleted successfully")
    } catch (error) {
      console.error("Error deleting lead:", error)
      toast.error("Error deleting lead")
    } finally {
      setIsDeletingLead(false)
    }
  }

  // Función para alternar asignación entre usuario actual y IA
  const handleToggleAssignee = async (leadId: string) => {
    if (!user?.id || !currentSite?.id) {
      toast.error("User not authenticated or site not selected")
      return
    }

    const lead = companyGroups
      .flatMap(group => group.leads)
      .find(l => l.id === leadId)
    
    if (!lead) return

    setAssigningLeads(prev => ({ ...prev, [leadId]: true }))
    
    try {
      // Si el lead está asignado a mí, asignar a IA (null)
      // Si no está asignado a mí, asignar a mí
      const newAssigneeId = lead.assignee_id === user.id ? null : user.id
      
      if (newAssigneeId === null) {
        // Asignar a IA usando updateLead
        const result = await updateLead({
          id: leadId,
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          position: lead.position,
          segment_id: lead.segment_id,
          status: lead.status,
          origin: lead.origin,
          site_id: currentSite.id,
          assignee_id: null
        })
        
        if (result.error) {
          toast.error(result.error)
          return
        }
        
        toast.success("Lead assigned to AI Team")
      } else {
        // Asignar a usuario actual
        const result = await assignLeadToUser(leadId, user.id, currentSite.id)
        
        if (result.error) {
          toast.error(result.error)
          return
        }
        
        toast.success("Lead assigned to you")
      }
      
      // Actualizar el lead localmente
      onUpdateLead?.(leadId, { assignee_id: newAssigneeId })
      invalidateJourneyStageCache(leadId)
      
    } catch (error) {
      console.error('Error toggling assignee:', error)
      toast.error("Failed to update assignee")
    } finally {
      setAssigningLeads(prev => ({ ...prev, [leadId]: false }))
    }
  }

  // Función para obtener el nombre del segmento
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    if (!segments || !Array.isArray(segments)) return "Unknown Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }

  // Función para obtener el nombre de la compañía (consistente con la página principal)
  const getCompanyName = (lead: Lead) => {
    if (lead.companies && lead.companies.name) {
      return lead.companies.name
    }
    if (lead.company && typeof lead.company === 'object' && lead.company.name) {
      return lead.company.name
    }
    if (typeof lead.company === 'string') {
      return lead.company
    }
    // Si no hay compañía, usar el nombre del lead como "compañía"
    return lead.name
  }

  const statusStyles = {
    new: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
    contacted: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200", 
    qualified: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200",
    converted: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
    lost: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
  }

  // Paginar las companies
  const paginatedCompanies = (companyGroups || []).slice(indexOfFirstItem, indexOfFirstItem + itemsPerPage)

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[250px] w-[300px] max-w-[300px]">Company</TableHead>
            <TableHead className="min-w-[200px] w-[250px] max-w-[250px]">Leads</TableHead>
            <TableHead className="w-[200px] min-w-[140px] max-w-[200px]">Segment / Position</TableHead>
            <TableHead className="w-[130px] min-w-[100px] max-w-[130px]">Status</TableHead>
            <TableHead className="w-[130px] min-w-[110px] max-w-[130px]">Journey Stage</TableHead>
            <TableHead className="w-[120px] min-w-[100px] max-w-[120px]">Assignee</TableHead>
            <TableHead className="w-[120px] min-w-[100px] max-w-[120px] text-right">AI Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedCompanies.length > 0 ? (
            paginatedCompanies.map((group) => (
              <React.Fragment key={group.companyKey}>
                {/* Fila principal de la empresa */}
                <TableRow 
                  className={`group hover:bg-muted/50 transition-colors ${group.leadCount > 1 ? 'cursor-pointer' : ''} border-b-2 ${
                    selectedLead?.id === group.mostAdvancedLead.id ? 'bg-primary/10 hover:bg-primary/15' : ''
                  }`}
                  onClick={() => {
                    if (group.leadCount > 1) {
                      onToggleCompanyExpansion(group.companyKey)
                    } else {
                      onLeadClick(group.mostAdvancedLead)
                    }
                  }}
                >
                  <TableCell className="min-w-[250px] w-[300px] max-w-[300px] overflow-hidden">
                    <div className="flex items-center space-x-3 min-w-0">
                      {group.leadCount > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            onToggleCompanyExpansion(group.companyKey)
                          }}
                        >
                          {group.isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="font-medium text-sm truncate" title={group.companyName}>{group.companyName}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-[200px] w-[250px] max-w-[250px] overflow-hidden">
                    {group.leadCount === 1 ? (
                      <div className="space-y-0.5 min-w-0 flex-1">
                        {/* Si tiene company real, mostrar nombre del lead */}
                        {((group.mostAdvancedLead.companies && group.mostAdvancedLead.companies.name) || 
                          (group.mostAdvancedLead.company && typeof group.mostAdvancedLead.company === 'object' && group.mostAdvancedLead.company.name) ||
                          (typeof group.mostAdvancedLead.company === 'string')) ? (
                          <>
                            <p className="text-sm font-medium truncate" title={group.mostAdvancedLead.name}>{group.mostAdvancedLead.name}</p>
                            <p className="text-sm text-muted-foreground truncate" title={group.mostAdvancedLead.email || group.mostAdvancedLead.phone || '-'}>
                              {group.mostAdvancedLead.email || group.mostAdvancedLead.phone || '-'}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium truncate" title={group.mostAdvancedLead.email || group.mostAdvancedLead.phone || '-'}>
                              {group.mostAdvancedLead.email || group.mostAdvancedLead.phone || '-'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate" title={group.mostAdvancedLead.email ? (group.mostAdvancedLead.phone || '-') : '-'}>
                              {group.mostAdvancedLead.email ? (group.mostAdvancedLead.phone || '-') : '-'}
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center justify-start">
                        <Badge variant="secondary" className="text-sm font-medium">
                          {group.leadCount}
                        </Badge>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium w-[200px] min-w-[140px] max-w-[200px] overflow-hidden">
                    <div className="line-clamp-1 min-w-0" title={getSegmentName(group.mostAdvancedLead.segment_id)}>
                      {getSegmentName(group.mostAdvancedLead.segment_id)}
                    </div>
                  </TableCell>
                  <TableCell className="w-[130px] min-w-[100px] max-w-[130px] overflow-hidden">
                    <Badge className={`${statusStyles[group.mostAdvancedLead.status]}`}>
                      {String(group.mostAdvancedLead.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-[130px] min-w-[110px] max-w-[130px] overflow-hidden">
                    {isLoadingJourneyStages || reloadingLeads.has(group.mostAdvancedLead.id) ? (
                      <Skeleton className="h-5 w-16 rounded-full" />
                    ) : (
                      <Badge className={`${JOURNEY_STAGE_COLORS[group.mostAdvancedStage || 'not_contacted']}`}>
                        {getJourneyStageName(group.mostAdvancedStage || 'not_contacted')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="w-[120px] min-w-[100px] max-w-[120px] overflow-hidden">
                    <div className="flex items-center min-w-0">
                      {group.mostAdvancedLead.assignee_id ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md min-w-0 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                                disabled={assigningLeads[group.mostAdvancedLead.id]}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  handleToggleAssignee(group.mostAdvancedLead.id)
                                }}
                              >
                                {assigningLeads[group.mostAdvancedLead.id] ? (
                                  <Loader className="h-3 w-3 flex-shrink-0" />
                                ) : (
                                  <UserIcon className="h-3 w-3 flex-shrink-0" />
                                )}
                                <span className="text-xs font-medium truncate">
                                  {group.mostAdvancedLead.assignee_id === user?.id 
                                    ? 'You' 
                                    : userData[group.mostAdvancedLead.assignee_id]?.name || 'Assigned'}
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Click to {group.mostAdvancedLead.assignee_id === user?.id 
                                ? 'assign to AI Team' 
                                : 'assign to me'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                                disabled={assigningLeads[group.mostAdvancedLead.id]}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  handleToggleAssignee(group.mostAdvancedLead.id)
                                }}
                              >
                                {assigningLeads[group.mostAdvancedLead.id] ? (
                                  <Loader className="h-3 w-3 mr-1" />
                                ) : (
                                  <Sparkles className="h-3 w-3 mr-1" />
                                )}
                                <span>AI</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Click to assign to me</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right w-[120px] min-w-[100px] max-w-[120px] overflow-hidden">
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                            size="sm" 
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="sr-only">Open AI actions menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation()
                                handleLeadResearch(group.mostAdvancedLead.id, group.leadCount > 1, group.leads)
                              }}
                            disabled={loadingActions[group.mostAdvancedLead.id] === 'research'}
                            className="flex items-center"
                            >
                              {loadingActions[group.mostAdvancedLead.id] === 'research' ? (
                              <Loader className="mr-2 h-4 w-4" />
                              ) : successActions[group.mostAdvancedLead.id] === 'research' ? (
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                            ) : (
                              <Search className="mr-2 h-4 w-4" />
                            )}
                            <span>
                              {group.leadCount > 1 ? `Research all ${group.leadCount} leads` : 'Lead Research'}
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleLeadFollowUp(group.mostAdvancedLead.id, group.leadCount > 1, group.leads)
                              }}
                            disabled={loadingActions[group.mostAdvancedLead.id] === 'followup'}
                            className="flex items-center"
                            >
                              {loadingActions[group.mostAdvancedLead.id] === 'followup' ? (
                              <Loader className="mr-2 h-4 w-4" />
                              ) : successActions[group.mostAdvancedLead.id] === 'followup' ? (
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                            ) : (
                              <Mail className="mr-2 h-4 w-4" />
                            )}
                            <span>
                              {group.leadCount > 1 ? `Follow-up all ${group.leadCount} leads` : 'Lead Follow Up'}
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleLeadInvalidation(group.mostAdvancedLead.id, group.leadCount > 1, group.leads)
                            }}
                            disabled={loadingActions[group.mostAdvancedLead.id] === 'invalidation'}
                            className="flex items-center"
                          >
                            {loadingActions[group.mostAdvancedLead.id] === 'invalidation' ? (
                              <Loader className="mr-2 h-4 w-4" />
                            ) : successActions[group.mostAdvancedLead.id] === 'invalidation' ? (
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                            ) : (
                              <X className="mr-2 h-4 w-4" />
                            )}
                            <span>
                              {group.leadCount > 1 ? `Invalidate all ${group.leadCount} leads` : 'Lead Invalidation'}
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              onLeadClick(group.mostAdvancedLead)
                            }}
                            className="flex items-center"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            <span>Edit Lead</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleNewConversation(group.mostAdvancedLead.id)
                            }}
                            disabled={loadingActions[group.mostAdvancedLead.id] === 'newConversation'}
                            className="flex items-center"
                          >
                            {loadingActions[group.mostAdvancedLead.id] === 'newConversation' ? (
                              <Loader className="mr-2 h-4 w-4" />
                            ) : successActions[group.mostAdvancedLead.id] === 'newConversation' ? (
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                            ) : (
                              <MessageSquare className="mr-2 h-4 w-4" />
                            )}
                            <span>New Conversation</span>
                          </DropdownMenuItem>
                          {onDeleteLead && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteLead(group.mostAdvancedLead)
                                }}
                                className="flex items-center text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Delete Lead</span>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Filas expandidas de leads individuales */}
                {group.leadCount > 1 && group.isExpanded && group.leads.map((lead) => (
                  <TableRow
                    key={lead.id}
                    className={`group hover:bg-muted/30 transition-colors cursor-pointer border-l-4 border-l-blue-200 bg-muted/20 ${
                      selectedLead?.id === lead.id ? 'bg-primary/10 hover:bg-primary/15' : ''
                    }`}
                    onClick={() => onLeadClick(lead)}
                  >
                    <TableCell className="pl-12 min-w-[250px] w-[300px] max-w-[300px] overflow-hidden">
                      {/* Celda vacía para la columna Company */}
                    </TableCell>
                    <TableCell className="min-w-[200px] w-[250px] max-w-[250px] overflow-hidden">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <p className="font-medium text-sm line-clamp-1" title={String(lead.name || '')}>{String(lead.name || '')}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1" title={String(lead.email || '')}>{String(lead.email || '')}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium w-[200px] min-w-[140px] max-w-[200px] overflow-hidden">
                      <div className="line-clamp-1 min-w-0" title={lead.position || 'No position'}>
                        {lead.position || '-'}
                      </div>
                    </TableCell>
                    <TableCell className="w-[130px] min-w-[100px] max-w-[130px] overflow-hidden">
                      <Badge className={`${statusStyles[lead.status]}`}>
                        {String(lead.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-[130px] min-w-[110px] max-w-[130px] overflow-hidden">
                      {isLoadingJourneyStages || reloadingLeads.has(lead.id) ? (
                        <Skeleton className="h-5 w-16 rounded-full" />
                      ) : (
                        <Badge className={`${JOURNEY_STAGE_COLORS[leadJourneyStages[lead.id] || 'not_contacted']}`}>
                          {getJourneyStageName(leadJourneyStages[lead.id] || 'not_contacted')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="w-[120px] min-w-[100px] max-w-[120px] overflow-hidden">
                      <div className="flex items-center min-w-0">
                        {lead.assignee_id ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="flex items-center space-x-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md min-w-0 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors cursor-pointer"
                                  disabled={assigningLeads[lead.id]}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    handleToggleAssignee(lead.id)
                                  }}
                                >
                                  {assigningLeads[lead.id] ? (
                                    <Loader className="h-3 w-3 flex-shrink-0" />
                                  ) : (
                                    <UserIcon className="h-3 w-3 flex-shrink-0" />
                                  )}
                                  <span className="text-xs font-medium truncate">
                                    {lead.assignee_id === user?.id 
                                      ? 'You' 
                                      : userData[lead.assignee_id]?.name || 'Assigned'}
                                  </span>
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Click to {lead.assignee_id === user?.id 
                                  ? 'assign to AI Team' 
                                  : 'assign to me'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50"
                                  disabled={assigningLeads[lead.id]}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    handleToggleAssignee(lead.id)
                                  }}
                                >
                                  {assigningLeads[lead.id] ? (
                                    <Loader className="h-3 w-3 mr-1" />
                                  ) : (
                                    <Sparkles className="h-3 w-3 mr-1" />
                                  )}
                                  <span>AI</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Click to assign to me</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right w-[120px] min-w-[100px] max-w-[120px] overflow-hidden">
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="sr-only">Open AI actions menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleLeadResearch(lead.id)
                                }}
                              disabled={loadingActions[lead.id] === 'research'}
                              className="flex items-center"
                              >
                                {loadingActions[lead.id] === 'research' ? (
                                <Loader className="mr-2 h-4 w-4" />
                                ) : successActions[lead.id] === 'research' ? (
                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                              ) : (
                                <Search className="mr-2 h-4 w-4" />
                              )}
                              <span>Lead Research</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleLeadFollowUp(lead.id)
                                }}
                              disabled={loadingActions[lead.id] === 'followup'}
                              className="flex items-center"
                              >
                                {loadingActions[lead.id] === 'followup' ? (
                                <Loader className="mr-2 h-4 w-4" />
                                ) : successActions[lead.id] === 'followup' ? (
                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                              ) : (
                                <Mail className="mr-2 h-4 w-4" />
                              )}
                              <span>Lead Follow Up</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleLeadInvalidation(lead.id)
                              }}
                              disabled={loadingActions[lead.id] === 'invalidation'}
                              className="flex items-center"
                            >
                              {loadingActions[lead.id] === 'invalidation' ? (
                                <Loader className="mr-2 h-4 w-4" />
                              ) : successActions[lead.id] === 'invalidation' ? (
                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                              ) : (
                                <X className="mr-2 h-4 w-4" />
                              )}
                              <span>Lead Invalidation</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                onLeadClick(lead)
                              }}
                              className="flex items-center"
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              <span>Edit Lead</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                handleNewConversation(lead.id)
                              }}
                              disabled={loadingActions[lead.id] === 'newConversation'}
                              className="flex items-center"
                            >
                              {loadingActions[lead.id] === 'newConversation' ? (
                                <Loader className="mr-2 h-4 w-4" />
                              ) : successActions[lead.id] === 'newConversation' ? (
                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                              ) : (
                                <MessageSquare className="mr-2 h-4 w-4" />
                              )}
                              <span>New Conversation</span>
                            </DropdownMenuItem>
                            {onDeleteLead && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteLead(lead)
                                  }}
                                  className="flex items-center text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  <span>Delete Lead</span>
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center">
                <EmptyCard
                  icon={<Users className="h-16 w-16 text-muted-foreground" />}
                  title="No companies found"
                  description="There are no companies to display."
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{Math.min(indexOfFirstItem + 1, totalCompanies)}</span> to <span className="font-medium">{Math.min(indexOfFirstItem + itemsPerPage, totalCompanies)}</span> of <span className="font-medium">{totalCompanies}</span> companies ({totalLeads} leads)
          </p>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={onItemsPerPageChange}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={itemsPerPage.toString()} />
            </SelectTrigger>
            <SelectContent side="top">
              {[5, 10, 20, 50].map((value) => (
                <SelectItem key={value} value={value.toString()}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{leadToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLead}
              disabled={isDeletingLead}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeletingLead ? (
                <>
                  <Loader className="mr-2 h-4 w-4" />
                  Deleting...
                </>
              ) : (
                'Delete Lead'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
} 