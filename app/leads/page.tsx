"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { ChevronLeft, ChevronRight, Search, User, MessageSquare, Globe, FileText, RotateCcw, Tag, X, CheckCircle2, ExternalLink, Phone, Pencil, Mail, Filter } from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { useSite } from "@/app/context/SiteContext"
import { getLeads, createLead, updateLead } from "./actions"
import { CreateLeadDialog } from "@/app/components/create-lead-dialog"
import { toast } from "sonner"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/control-center/actions/campaigns/read"
import React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/app/components/ui/sheet"
import { Separator } from "@/app/components/ui/separator"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { KanbanView, LeadFilters } from "@/app/components/kanban-view"
import { LeadFilterModal } from "@/app/components/ui/lead-filter-modal"
import { useRouter } from "next/navigation"
import { Lead } from "@/app/leads/types"
import { Campaign } from "@/app/types"

interface LeadsTableProps {
  leads: Lead[]
  currentPage: number
  itemsPerPage: number
  totalLeads: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (value: string) => void
  onLeadClick: (lead: Lead) => void
}

function LeadsTable({ 
  leads,
  currentPage,
  itemsPerPage,
  totalLeads,
  onPageChange,
  onItemsPerPageChange,
  onLeadClick
}: LeadsTableProps) {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalLeads / itemsPerPage)
  const { segments } = useLeadsContext()
  const { currentSite } = useSite()
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  
  // Debug logs
  console.log('Leads:', leads)
  console.log('Segments:', segments)
  
  // Función para obtener el nombre del segmento
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    if (!segments || !Array.isArray(segments)) return "Unknown Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }

  // Función para truncar texto largo
  const truncateText = (text: any, maxLength: number = 15) => {
    if (!text) return "-"
    if (typeof text === 'object') {
      if (text.name) return String(text.name)
      return "-"
    }
    const stringValue = String(text)
    if (stringValue.length <= maxLength) return stringValue
    return `${stringValue.substring(0, maxLength)}...`
  }

  const statusStyles = {
    new: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
    contacted: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200", 
    qualified: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200",
    converted: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
    lost: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
  }
  
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Segment</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {leads.length > 0 ? (
              leads.map((lead) => {
                // Debug log for each lead
                console.log('Rendering lead:', lead)
                return (
                  <TableRow 
                    key={lead.id}
                    className={`group hover:bg-muted/50 transition-colors cursor-pointer ${selectedLead?.id === lead.id ? 'bg-primary/10 hover:bg-primary/15' : ''}`}
                    onClick={() => onLeadClick(lead)}
                  >
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium text-sm">{String(lead.name || '')}</p>
                        <p className="text-xs text-muted-foreground">{String(lead.email || '')}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {truncateText(lead.phone)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {truncateText(lead.company)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {truncateText(getSegmentName(lead.segment_id))}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusStyles[lead.status]}`}>
                        {String(lead.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(`mailto:${lead.email}`)
                          }}
                        >
                          <Mail className="h-4 w-4" />
                          <span className="sr-only">Email</span>
                        </Button>
                        {lead.phone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation()
                              window.open(`tel:${lead.phone}`)
                            }}
                          >
                            <Phone className="h-4 w-4" />
                            <span className="sr-only">Call</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No leads found.
                </TableCell>
              </TableRow>
            )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            Showing <span className="font-medium">{Math.min(indexOfFirstItem + 1, totalLeads)}</span> to <span className="font-medium">{Math.min(indexOfFirstItem + itemsPerPage, totalLeads)}</span> of <span className="font-medium">{totalLeads}</span> leads
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
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Previous page</span>
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant="ghost"
                size="sm"
                onClick={() => onPageChange(page)}
                className={`!min-w-0 h-8 w-8 p-0 font-medium transition-colors ${
                  currentPage === page 
                    ? "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {page}
              </Button>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
            className="h-8 w-8 p-0 hover:bg-muted/50 disabled:opacity-50"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </Card>
  )
}

// Contexto para manejar los segmentos
interface LeadsContextType {
  segments: Array<{ id: string; name: string }>
}

const LeadsContext = React.createContext<LeadsContextType>({
  segments: []
})

const useLeadsContext = () => React.useContext(LeadsContext)

// Componente Skeleton para carga de la tabla de leads
function LeadsTableSkeleton() {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">
              <Skeleton className="h-4 w-24" />
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="whitespace-nowrap">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[150px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[120px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[120px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
            <TableHead className="w-[120px]">
              <Skeleton className="h-4 w-16" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array(5).fill(0).map((_, index) => (
            <TableRow key={index}>
              <TableCell>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-24 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-5 w-20 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-20" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-24 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </Card>
  )
}

export default function LeadsPage() {
  const router = useRouter()
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [activeTab, setActiveTab] = useState("all")
  const [dbLeads, setDbLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [viewType, setViewType] = useState<ViewType>("table")
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [filters, setFilters] = useState<LeadFilters>({
    status: [],
    segments: [],
    origin: []
  })
  const { currentSite } = useSite()
  
  // Función para obtener el nombre del segmento
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    if (!segments || !Array.isArray(segments)) return "Unknown Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }
  
  // Estilos para los diferentes estados
  const statusStyles = {
    new: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200",
    contacted: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200", 
    qualified: "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200",
    converted: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
    lost: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
  }
  
  // Función para cargar leads desde la base de datos
  const loadLeads = async () => {
    if (!currentSite?.id) return

    setLoading(true)
    try {
      const result = await getLeads(currentSite.id)
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Asegurarse de que todos los leads tienen todos los campos de la interfaz Lead
      const normalizedLeads = result.leads?.map(lead => ({
        ...lead,
        origin: lead.origin || null // Asegurarnos que origin esté definido
      })) || []
      
      setDbLeads(normalizedLeads)
    } catch (error) {
      console.error("Error loading leads:", error)
      toast.error("Error loading leads")
    } finally {
      setLoading(false)
    }
  }

  // Cargar leads desde la base de datos
  useEffect(() => {
    async function loadSegments() {
      if (!currentSite?.id) return
      
      try {
        const response = await getSegments(currentSite.id)
        if (response.error) {
          console.error(response.error)
          return
        }
        
        if (response.segments) {
          setSegments(response.segments.map(s => ({ id: s.id, name: s.name })))
        }
      } catch (error) {
        console.error("Error loading segments:", error)
      }
    }
    
    async function loadCampaigns() {
      if (!currentSite?.id) return
      
      try {
        const result = await getCampaigns(currentSite.id)
        
        if (result.error) {
          console.error(result.error)
          return
        }
        
        setCampaigns(result.data || [])
      } catch (error) {
        console.error("Error loading campaigns:", error)
      }
    }

    loadLeads()
    loadSegments()
    loadCampaigns()
  }, [currentSite])
  
  const getFilteredLeads = (status: string) => {
    if (!dbLeads) return []
    
    // First filter by status
    let filtered = dbLeads
    if (status !== "all") {
      filtered = filtered.filter(lead => lead.status === status)
    }
    
    // Then filter by search query if it exists
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(lead => 
        lead.name.toLowerCase().includes(query) || 
        lead.email.toLowerCase().includes(query) || 
        (lead.company && lead.company.toLowerCase().includes(query)) ||
        (lead.position && lead.position.toLowerCase().includes(query)) ||
        (lead.phone && lead.phone.toLowerCase().includes(query)) ||
        (lead.origin && lead.origin.toLowerCase().includes(query))
      )
    }
    
    // Apply advanced filters
    if (filters.status.length > 0) {
      filtered = filtered.filter(lead => filters.status.includes(lead.status))
    }
    
    if (filters.segments.length > 0) {
      filtered = filtered.filter(lead => 
        lead.segment_id && filters.segments.includes(lead.segment_id)
      )
    }
    
    if (filters.origin.length > 0) {
      filtered = filtered.filter(lead => 
        lead.origin && filters.origin.includes(lead.origin)
      )
    }
    
    return filtered
  }
  
  const filteredLeads = getFilteredLeads(activeTab)
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage)
  
  // Calcular los leads que se mostrarán en la página actual
  const indexOfLastItem = currentPage * itemsPerPage
  const indexOfFirstItem = indexOfLastItem - itemsPerPage
  const currentLeads = filteredLeads.slice(indexOfFirstItem, indexOfLastItem)
  
  // Funciones para cambiar de página
  function handlePageChange(page: number) {
    setCurrentPage(page)
  }

  // Reset página cuando cambia el tab
  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab])

  // Función para cambiar items por página
  function handleItemsPerPageChange(value: string) {
    setItemsPerPage(Number(value))
    setCurrentPage(1)
  }
  
  // Función para crear un nuevo lead
  const handleCreateLead = async (data: any) => {
    try {
      const result = await createLead({
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        position: data.position,
        segment_id: data.segment_id,
        campaign_id: data.campaign_id,
        status: data.status,
        notes: data.notes,
        origin: data.origin,
        site_id: currentSite?.id || ""
      })

      if (result.error) {
        toast.error(result.error)
        return { error: result.error }
      }

      toast.success("Lead created successfully")
      
      // Recargar los leads
      window.location.reload()
      
      return { lead: result.lead }
    } catch (error) {
      console.error("Error creating lead:", error)
      toast.error("Error creating lead")
      return { error: "Error creating lead" }
    }
  }

  // Función para manejar cambios en el buscador
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1) // Reset a la primera página cuando se busca
  }

  // Función para actualizar el estado de un lead (para la vista Kanban)
  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    const lead = dbLeads.find(l => l.id === leadId)
    if (!lead) return
    
    try {
      const result = await updateLead({
        id: leadId,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        position: lead.position,
        segment_id: lead.segment_id,
        status: newStatus as any,
        origin: lead.origin,
        site_id: currentSite?.id || ""
      })
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Actualizamos el lead en el estado local
      setDbLeads(prevLeads => 
        prevLeads.map(l => 
          l.id === leadId ? { ...l, status: newStatus as any } : l
        )
      );
      
      toast.success("Lead status updated successfully")
    } catch (error) {
      console.error("Error updating lead status:", error)
      toast.error("Error updating lead status")
    }
  }

  // Función para manejar el clic en una fila o tarjeta
  const handleLeadClick = (lead: Lead) => {
    router.push(`/leads/${lead.id}`);
  };

  // Función para aplicar filtros
  const handleApplyFilters = (newFilters: LeadFilters) => {
    setFilters(newFilters)
    setCurrentPage(1) // Reset a la primera página cuando se aplican filtros
  }
  
  // Función para limpiar todos los filtros
  const handleClearFilters = () => {
    setFilters({
      status: [],
      segments: [],
      origin: []
    })
    setSearchQuery("")
    setCurrentPage(1)
  }
  
  // Función para abrir el modal de filtros
  const handleOpenFilterModal = () => {
    setIsFilterModalOpen(true)
  }
  
  return (
    <LeadsContext.Provider value={{ segments }}>
    <div className="flex-1 p-0">
      {/* Modal de filtros */}
      <LeadFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        segments={segments}
      />
      
      <Tabs defaultValue={activeTab} className="h-full space-y-6">
        <StickyHeader showAIButton={false}>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="all" className="text-sm font-medium">All Leads</TabsTrigger>
                  <TabsTrigger value="new" className="text-sm font-medium">New</TabsTrigger>
                  <TabsTrigger value="contacted" className="text-sm font-medium">Contacted</TabsTrigger>
                  <TabsTrigger value="qualified" className="text-sm font-medium">Qualified</TabsTrigger>
                  <TabsTrigger value="converted" className="text-sm font-medium">Converted</TabsTrigger>
                  <TabsTrigger value="lost" className="text-sm font-medium">Lost</TabsTrigger>
                </TabsList>
                <div className="relative w-64">
                  <Input 
                    placeholder="Search leads..." 
                    className="w-full" 
                    icon={<Search className="h-4 w-4 text-muted-foreground" />}
                    value={searchQuery}
                    onChange={handleSearchChange}
                  />
                  <kbd className="pointer-events-none absolute right-2 top-4 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </div>
                <Button variant="outline" onClick={handleOpenFilterModal}>
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </div>
              <div className="ml-auto flex items-center gap-4">
                {(filters.status.length > 0 || filters.segments.length > 0 || filters.origin.length > 0) && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    <Badge variant="outline" className="rounded-full px-2 py-0">
                      {filters.status.length + filters.segments.length + filters.origin.length}
                    </Badge>
                    <span className="ml-2">Clear filters</span>
                  </Button>
                )}
                <ViewSelector currentView={viewType} onViewChange={setViewType} />
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            {loading ? (
              <LeadsTableSkeleton />
            ) : (
              <>
                <TabsContent value="all" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="new" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="contacted" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="qualified" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="converted" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
                
                <TabsContent value="lost" className="space-y-4">
                  {viewType === "table" ? (
                    <LeadsTable
                      leads={currentLeads}
                      currentPage={currentPage}
                      itemsPerPage={itemsPerPage}
                      totalLeads={filteredLeads.length}
                      onPageChange={handlePageChange}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      onLeadClick={handleLeadClick}
                    />
                  ) : (
                    <KanbanView 
                      leads={filteredLeads}
                      onUpdateLeadStatus={handleUpdateLeadStatus}
                      segments={segments}
                      onLeadClick={handleLeadClick}
                      filters={filters}
                      onOpenFilters={handleOpenFilterModal}
                    />
                  )}
                </TabsContent>
              </>
            )}
          </div>
        </div>
      </Tabs>
      
    </div>
    </LeadsContext.Provider>
  )
} 