"use client"

import { useState, useEffect } from "react"
import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Input } from "@/app/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import { Badge } from "@/app/components/ui/badge"
import { ChevronLeft, ChevronRight, Search, User, MessageSquare, Globe, FileText, RotateCcw, Tag, X, CheckCircle2, ExternalLink, Phone, Pencil } from "@/app/components/ui/icons"
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
}

function LeadsTable({ 
  leads,
  currentPage,
  itemsPerPage,
  totalLeads,
  onPageChange,
  onItemsPerPageChange
}: LeadsTableProps) {
  const indexOfFirstItem = (currentPage - 1) * itemsPerPage
  const totalPages = Math.ceil(totalLeads / itemsPerPage)
  const { segments } = useLeadsContext()
  const { currentSite } = useSite()
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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

  const handleRowClick = (lead: Lead) => {
    setSelectedLead(lead)
    setIsEditing(false)
    setEditForm({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      position: lead.position,
      segment_id: lead.segment_id,
      status: lead.status,
      origin: lead.origin
    })
    setIsDetailOpen(true)
  }

  const handleStartEditing = () => {
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    setIsEditing(false)
    if (selectedLead) {
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
    }
  }

  const sendEmail = (email: string) => {
    window.open(`mailto:${email}`, '_blank');
  }

  const callPhone = (phone: string) => {
    window.open(`tel:${phone}`, '_blank');
  }

  const sendMessage = (phone: string) => {
    window.open(`sms:${phone}`, '_blank');
  }

  const handleSaveChanges = async () => {
    if (!selectedLead || !currentSite?.id) return

    try {
      setIsSaving(true)
      const result = await updateLead({
        id: selectedLead.id,
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        company: editForm.company,
        position: editForm.position,
        segment_id: editForm.segment_id,
        status: editForm.status,
        origin: editForm.origin,
        notes: null, // No tenemos interfaz para notas aún
        site_id: currentSite.id
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.lead) {
        toast.success("Lead updated successfully")
        setSelectedLead({
          ...result.lead,
          origin: result.lead.origin || null // Asegurarnos que origin esté definido 
        })
        setIsEditing(false)

        // Recargar los leads para actualizar la tabla
        window.location.reload()
      }
    } catch (error) {
      console.error("Error updating lead:", error)
      toast.error("Error updating lead")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="whitespace-nowrap">Name/Email</TableHead>
            <TableHead className="whitespace-nowrap">Phone</TableHead>
            <TableHead className="whitespace-nowrap">Company</TableHead>
            <TableHead className="w-[150px]">Position</TableHead>
            <TableHead className="w-[120px]">Segment</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[120px]">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
            {leads.length > 0 ? (
              leads.map((lead) => (
            <TableRow 
              key={lead.id}
                  className={`group hover:bg-muted/50 transition-colors cursor-pointer ${selectedLead?.id === lead.id ? 'bg-primary/10 hover:bg-primary/15' : ''}`}
                  onClick={() => handleRowClick(lead)}
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
              <TableCell className="text-muted-foreground text-sm">
                    {lead.position || "-"}
              </TableCell>
              <TableCell>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {lead.segment_id ? truncateText(getSegmentName(lead.segment_id)) : "No Segment"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge className={statusStyles[lead.status]}>
                  {lead.status.charAt(0).toUpperCase() + lead.status.slice(1)}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                    {new Date(lead.created_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No leads found.
                </TableCell>
              </TableRow>
            )}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium">{leads.length > 0 ? indexOfFirstItem + 1 : 0}</span> to{" "}
            <span className="font-medium">{Math.min(indexOfFirstItem + itemsPerPage, totalLeads)}</span> of{" "}
            <span className="font-medium">{totalLeads}</span> records
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={onItemsPerPageChange}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder="5" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">per page</span>
          </div>
        </div>
        <div className="flex items-center space-x-6">
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
          <div className="flex items-center gap-2">
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

      <Sheet open={isDetailOpen} onOpenChange={(open) => {
        setIsDetailOpen(open);
        if (!open) {
          setSelectedLead(null);
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
                                onClick={() => sendEmail(selectedLead.email)}
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
                                    onClick={() => callPhone(selectedLead.phone!)}
                                    className="h-8"
                                  >
                                    <Phone className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => sendMessage(selectedLead.phone!)}
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
                    <Button onClick={handleCancelEditing} variant="outline" className="w-full">
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
                    <Button onClick={handleStartEditing} variant="outline" className="w-full">
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
    </>
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
  const { currentSite } = useSite()
  
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

  return (
    <LeadsContext.Provider value={{ segments }}>
    <div className="flex-1 p-0">
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="all">All Leads</TabsTrigger>
                  <TabsTrigger value="new">New</TabsTrigger>
                  <TabsTrigger value="contacted">Contacted</TabsTrigger>
                  <TabsTrigger value="qualified">Qualified</TabsTrigger>
                  <TabsTrigger value="converted">Converted</TabsTrigger>
                  <TabsTrigger value="lost">Lost</TabsTrigger>
                </TabsList>
              </div>
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
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </TabsContent>
            <TabsContent value="new" className="space-y-4">
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </TabsContent>
            <TabsContent value="contacted" className="space-y-4">
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </TabsContent>
            <TabsContent value="qualified" className="space-y-4">
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </TabsContent>
            <TabsContent value="converted" className="space-y-4">
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </TabsContent>
            <TabsContent value="lost" className="space-y-4">
              <LeadsTable
                leads={currentLeads}
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                totalLeads={filteredLeads.length}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
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