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
import React from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/app/components/ui/sheet"
import { Separator } from "@/app/components/ui/separator"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ViewSelector, ViewType } from "@/app/components/view-selector"
import { KanbanView, LeadFilters } from "@/app/components/kanban-view"
import { LeadFilterModal } from "@/app/components/ui/lead-filter-modal"

interface Lead {
  id: string
  name: string
  email: string
  phone: string | null
  company: string | null
  position: string | null
  segment_id: string | null
  status: "new" | "contacted" | "qualified" | "converted" | "lost"
  created_at: string
  origin: string | null
}

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
  
  // Función para obtener el nombre del segmento
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
    const segment = segments.find(s => s.id === segmentId)
    return segment?.name || "Unknown Segment"
  }

  // Función para truncar texto largo
  const truncateText = (text: string, maxLength: number = 15) => {
    if (!text || text.length <= maxLength) return text
    return `${text.substring(0, maxLength)}...`
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
              leads.map((lead) => (
            <TableRow 
              key={lead.id}
                  className={`group hover:bg-muted/50 transition-colors cursor-pointer ${selectedLead?.id === lead.id ? 'bg-primary/10 hover:bg-primary/15' : ''}`}
                  onClick={() => onLeadClick(lead)}
            >
              <TableCell>
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">{lead.name}</p>
                  <p className="text-xs text-muted-foreground">{lead.email}</p>
                </div>
              </TableCell>
              <TableCell className="font-medium">
                {lead.phone || "-"}
              </TableCell>
              <TableCell className="font-medium">
                {lead.company || "-"}
              </TableCell>
              <TableCell className="font-medium">
                {lead.segment_id ? truncateText(getSegmentName(lead.segment_id)) : "No Segment"}
              </TableCell>
              <TableCell>
                <Badge className={`${statusStyles[lead.status]}`}>
                  {lead.status}
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
          ))
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
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const [activeTab, setActiveTab] = useState("all")
  const [dbLeads, setDbLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [viewType, setViewType] = useState<ViewType>("table")
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [filters, setFilters] = useState<LeadFilters>({
    status: [],
    segments: [],
    origin: []
  })
  const [editForm, setEditForm] = useState<Omit<Lead, "id" | "created_at">>({
    name: "",
    email: "",
    phone: null,
    company: null,
    position: null,
    segment_id: null,
    status: "new",
    origin: null
  })
  const { currentSite } = useSite()
  
  // Función para obtener el nombre del segmento
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return "No Segment"
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
  
  // Función para guardar los cambios
  const handleSaveChanges = async () => {
    if (!selectedLead || !currentSite?.id) return
    
    setIsSaving(true)
    try {
      const result = await updateLead({
        id: selectedLead.id,
        ...editForm,
        site_id: currentSite.id
      })
      
      if (result.error) {
        toast.error(result.error)
        return
      }
      
      // Actualizar el lead en el estado local
      setDbLeads(prevLeads => 
        prevLeads.map(l => 
          l.id === selectedLead.id ? { ...l, ...editForm, id: selectedLead.id, created_at: selectedLead.created_at } : l
        )
      )
      
      setIsEditing(false)
      toast.success("Lead updated successfully")
    } catch (error) {
      console.error("Error updating lead:", error)
      toast.error("Error updating lead")
    } finally {
      setIsSaving(false)
    }
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

    loadLeads()
    loadSegments()
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
    setSelectedLead(lead);
    setIsEditing(false);
    setEditForm({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      position: lead.position,
      segment_id: lead.segment_id,
      status: lead.status,
      origin: lead.origin
    });
    setIsDetailOpen(true);
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
      
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="all">All Leads</TabsTrigger>
                  <TabsTrigger value="new">New</TabsTrigger>
                  <TabsTrigger value="contacted">Contacted</TabsTrigger>
                  <TabsTrigger value="qualified">Qualified</TabsTrigger>
                  <TabsTrigger value="converted">Converted</TabsTrigger>
                  <TabsTrigger value="lost">Lost</TabsTrigger>
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
                {/* Indicador de filtros activos */}
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
      
      {/* Sheet para mostrar los detalles del lead */}
      <Sheet open={isDetailOpen} onOpenChange={(open) => {
        setIsDetailOpen(open);
        if (!open) {
          setSelectedLead(null);
          setIsEditing(false);
        }
      }}>
        <SheetContent className="sm:max-w-md border-l border-border/40 bg-background">
          {selectedLead && (
            <>
              <SheetHeader className="pb-6">
                {isEditing ? (
                  <div className="mt-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-md flex items-center justify-center mt-4" style={{ width: '48px', height: '48px' }}>
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Name</p>
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          className="h-12 text-sm font-semibold"
                          placeholder="Lead name"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <SheetTitle className="text-2xl mt-4">{selectedLead.name}</SheetTitle>
                  </>
                )}
              </SheetHeader>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-5">
                  {/* Información de contacto */}
                  <div className="bg-muted/40 rounded-lg p-4 border border-border/30">
                    <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                      Contact Information
                    </h3>
                    
                    <div className="grid gap-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-[5px]">Email</p>
                          {isEditing ? (
                            <Input
                              value={editForm.email}
                              onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                              className="h-12 text-sm"
                              placeholder="email@example.com"
                            />
                          ) : (
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{selectedLead.email}</p>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(`mailto:${selectedLead.email}`, '_blank')}
                                className="h-8 ml-2"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <Phone className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-[5px]">Phone</p>
                          {isEditing ? (
                            <Input
                              value={editForm.phone || ""}
                              onChange={(e) => setEditForm({...editForm, phone: e.target.value || null})}
                              className="h-12 text-sm"
                              placeholder="Phone number"
                            />
                          ) : (
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">{selectedLead.phone || "Not specified"}</p>
                              {selectedLead.phone && (
                                <div className="flex space-x-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.open(`tel:${selectedLead.phone}`)
                                    }}
                                    className="h-8"
                                  >
                                    <Phone className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      window.open(`sms:${selectedLead.phone}`)
                                    }}
                                    className="h-8"
                                  >
                                    <MessageSquare className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <Globe className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-[5px]">Company</p>
                          {isEditing ? (
                            <Input
                              value={editForm.company || ""}
                              onChange={(e) => setEditForm({...editForm, company: e.target.value || null})}
                              className="h-12 text-sm"
                              placeholder="Company name"
                            />
                          ) : (
                            <p className="text-sm font-medium">{selectedLead.company || "Not specified"}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-[5px]">Position</p>
                          {isEditing ? (
                            <Input
                              value={editForm.position || ""}
                              onChange={(e) => setEditForm({...editForm, position: e.target.value || null})}
                              className="h-12 text-sm"
                              placeholder="Position or role"
                            />
                          ) : (
                            <p className="text-sm font-medium">{selectedLead.position || "Not specified"}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <Tag className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-[5px]">Segment</p>
                          {isEditing ? (
                            <Select 
                              value={editForm.segment_id || "none"}
                              onValueChange={(value) => setEditForm({...editForm, segment_id: value === "none" ? null : value})}
                            >
                              <SelectTrigger className="h-12 text-sm">
                                <SelectValue placeholder="Select segment" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Not specified</SelectItem>
                                {segments.map((segment) => (
                                  <SelectItem key={segment.id} value={segment.id}>
                                    {segment.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm font-medium">{getSegmentName(selectedLead.segment_id)}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-[5px]">Status</p>
                          {isEditing ? (
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
                          ) : (
                            <div>
                              <Badge className={`text-xs ${statusStyles[selectedLead.status]}`}>
                                {selectedLead.status.charAt(0).toUpperCase() + selectedLead.status.slice(1)}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-md flex items-center justify-center mt-[22px]" style={{ width: '48px', height: '48px' }}>
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-[5px]">Origin</p>
                          {isEditing ? (
                            <Input
                              value={editForm.origin || ""}
                              onChange={(e) => setEditForm({...editForm, origin: e.target.value || null})}
                              className="h-12 text-sm"
                              placeholder="Lead origin"
                            />
                          ) : (
                            <p className="text-sm font-medium">{selectedLead.origin || "Not specified"}</p>
                          )}
                        </div>
                      </div>
                    </div>
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
                          {new Date(selectedLead.created_at).toLocaleDateString()}
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
                          {new Date(selectedLead.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 grid grid-cols-2 gap-3">
                {isEditing ? (
                  <>
                    <Button onClick={() => {
                      setIsEditing(false)
                      setEditForm({
                        name: selectedLead.name,
                        email: selectedLead.email,
                        phone: selectedLead.phone,
                        company: selectedLead.company,
                        position: selectedLead.position,
                        segment_id: selectedLead.segment_id,
                        status: selectedLead.status,
                        origin: selectedLead.origin
                      })
                    }} variant="outline" className="w-full">
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button onClick={handleSaveChanges} className="w-full">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => {
                      setIsEditing(true)
                      setEditForm({
                        name: selectedLead.name,
                        email: selectedLead.email,
                        phone: selectedLead.phone,
                        company: selectedLead.company,
                        position: selectedLead.position,
                        segment_id: selectedLead.segment_id,
                        status: selectedLead.status,
                        origin: selectedLead.origin
                      })
                    }} variant="outline" className="w-full">
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="destructive" className="w-full">
                      <X className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
    </LeadsContext.Provider>
  )
} 