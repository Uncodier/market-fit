import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { Badge } from "@/app/components/ui/badge"
import { 
  Filter, 
  Tag, 
  CheckCircle2, 
  Ban, 
  RotateCcw, 
  ChevronUp,
  ChevronDown, 
  Users, 
  X,
  Globe,
  MessageSquare
} from "@/app/components/ui/icons"

// Define tipos para los filtros
export interface LeadFilters {
  status: string[]
  segments: string[]
  origin: string[]
}

interface LeadFilterModalProps {
  isOpen: boolean
  onClose: () => void
  filters: LeadFilters
  onApplyFilters: (filters: LeadFilters) => void
  segments: Array<{ id: string; name: string }>
  statusOptions?: string[]
  originOptions?: string[]
}

export function LeadFilterModal({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  segments,
  statusOptions = ["new", "contacted", "qualified", "converted", "lost"],
  originOptions = ["website", "referral", "social", "email", "phone", "other"]
}: LeadFilterModalProps) {
  // Estado local para los filtros
  const [localFilters, setLocalFilters] = useState<LeadFilters>({
    status: [...filters.status],
    segments: [...filters.segments],
    origin: [...filters.origin]
  })
  
  // Estado para las secciones expandidas
  const [expandedSections, setExpandedSections] = useState({
    status: true,
    segments: true,
    origin: true
  })
  
  // Función para cambiar el estado de una sección
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }
  
  // Función para manejar cambios en el estado
  const handleStatusChange = (value: string) => {
    setLocalFilters(prev => {
      if (prev.status.includes(value)) {
        return {
          ...prev,
          status: prev.status.filter(s => s !== value)
        }
      } else {
        return {
          ...prev,
          status: [...prev.status, value]
        }
      }
    })
  }
  
  // Función para manejar cambios en el segmento
  const handleSegmentChange = (value: string) => {
    setLocalFilters(prev => {
      if (prev.segments.includes(value)) {
        return {
          ...prev,
          segments: prev.segments.filter(s => s !== value)
        }
      } else {
        return {
          ...prev,
          segments: [...prev.segments, value]
        }
      }
    })
  }
  
  // Función para manejar cambios en el origen
  const handleOriginChange = (value: string) => {
    setLocalFilters(prev => {
      if (prev.origin.includes(value)) {
        return {
          ...prev,
          origin: prev.origin.filter(o => o !== value)
        }
      } else {
        return {
          ...prev,
          origin: [...prev.origin, value]
        }
      }
    })
  }
  
  // Función para resetear los filtros
  const handleResetFilters = () => {
    setLocalFilters({
      status: [],
      segments: [],
      origin: []
    })
  }
  
  // Función para aplicar los filtros
  const handleApplyFilters = () => {
    onApplyFilters(localFilters)
    onClose()
  }
  
  // Función para obtener el total de filtros activos
  const getTotalActiveFilters = () => {
    return localFilters.status.length + localFilters.segments.length + localFilters.origin.length
  }
  
  // Función para obtener el icono del estado
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "new":
        return <Tag className="h-4 w-4 text-blue-500" />
      case "contacted":
        return <MessageSquare className="h-4 w-4 text-yellow-500" />
      case "qualified":
        return <CheckCircle2 className="h-4 w-4 text-purple-500" />
      case "converted":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "lost":
        return <Ban className="h-4 w-4 text-red-500" />
      default:
        return <Tag className="h-4 w-4" />
    }
  }
  
  // Función para obtener el icono del origen
  const getOriginIcon = (origin: string) => {
    switch (origin) {
      case "website":
        return <Globe className="h-4 w-4 text-blue-500" />
      case "referral":
        return <Users className="h-4 w-4 text-green-500" />
      case "social":
        return <MessageSquare className="h-4 w-4 text-purple-500" />
      case "email":
        return <MessageSquare className="h-4 w-4 text-yellow-500" />
      case "phone":
        return <MessageSquare className="h-4 w-4 text-red-500" />
      default:
        return <Tag className="h-4 w-4" />
    }
  }
  
  // Función para obtener la clase del badge de estado
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200"
      case "contacted":
        return "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
      case "qualified":
        return "bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200"
      case "converted":
        return "bg-green-100 text-green-700 hover:bg-green-100 border-green-200"
      case "lost":
        return "bg-red-100 text-red-700 hover:bg-red-100 border-red-200"
      default:
        return "bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200"
    }
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Leads
          </DialogTitle>
          <DialogDescription>
            Apply filters to narrow down your leads list.
            {getTotalActiveFilters() > 0 && (
              <Badge variant="outline" className="ml-2">
                {getTotalActiveFilters()} active filters
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          {/* Status Filter */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => toggleSection('status')}
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Status</h3>
                {localFilters.status.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {localFilters.status.length}
                  </Badge>
                )}
              </div>
              {expandedSections.status ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            {expandedSections.status && (
              <div className="px-3 py-[10px] border-t">
                <div className="grid grid-cols-2 gap-2">
                  {statusOptions.map(status => (
                    <div key={status} className="flex items-center space-x-2">
                      <Switch 
                        id={`status-${status}`}
                        checked={localFilters.status.includes(status)}
                        onCheckedChange={() => handleStatusChange(status)}
                      />
                      <Label 
                        htmlFor={`status-${status}`}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        {getStatusIcon(status)}
                        <span className="capitalize">{status}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Segments Filter */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => toggleSection('segments')}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Segments</h3>
                {localFilters.segments.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {localFilters.segments.length}
                  </Badge>
                )}
              </div>
              {expandedSections.segments ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            {expandedSections.segments && (
              <div className="px-3 py-[10px] border-t">
                <div className="grid grid-cols-1 gap-2">
                  {segments.map(segment => (
                    <div key={segment.id} className="flex items-center space-x-2">
                      <Switch 
                        id={`segment-${segment.id}`}
                        checked={localFilters.segments.includes(segment.id)}
                        onCheckedChange={() => handleSegmentChange(segment.id)}
                      />
                      <Label 
                        htmlFor={`segment-${segment.id}`}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{segment.name}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          {/* Origin Filter */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => toggleSection('origin')}
            >
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Origin</h3>
                {localFilters.origin.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {localFilters.origin.length}
                  </Badge>
                )}
              </div>
              {expandedSections.origin ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            
            {expandedSections.origin && (
              <div className="px-3 py-[10px] border-t">
                <div className="grid grid-cols-2 gap-2">
                  {originOptions.map(origin => (
                    <div key={origin} className="flex items-center space-x-2">
                      <Switch 
                        id={`origin-${origin}`}
                        checked={localFilters.origin.includes(origin)}
                        onCheckedChange={() => handleOriginChange(origin)}
                      />
                      <Label 
                        htmlFor={`origin-${origin}`}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        {getOriginIcon(origin)}
                        <span className="capitalize">{origin}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="flex justify-between">
          {getTotalActiveFilters() > 0 ? (
            <Button 
              variant="outline" 
              onClick={handleResetFilters}
              className="gap-1 text-muted-foreground hover:text-foreground"
              size="sm"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          ) : (
            <div></div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleApplyFilters}>
              Apply Filters
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 