import React from "react"
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
  X
} from "@/app/components/ui/icons"

// Define tipos para los filtros
export interface RequirementFilters {
  priority: string[]
  completionStatus: string[]
  segments: string[]
}

interface FilterModalProps {
  isOpen: boolean
  onClose: () => void
  filters: RequirementFilters
  onApplyFilters: (filters: RequirementFilters) => void
  segments: Array<{ id: string; name: string }>
  completionStatusOptions?: string[]
}

export function FilterModal({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  segments,
  completionStatusOptions = ["pending", "completed", "rejected"]
}: FilterModalProps) {
  // Estado local para los filtros durante la edición
  const [localFilters, setLocalFilters] = React.useState<RequirementFilters>(filters)

  // Resetear los filtros locales cuando cambia el estado isOpen
  React.useEffect(() => {
    if (isOpen) {
      setLocalFilters(filters)
    }
  }, [isOpen, filters])

  // Función para actualizar filtros de prioridad
  const handlePriorityChange = (value: string) => {
    const newPriorities = [...localFilters.priority]
    const index = newPriorities.indexOf(value)
    
    if (index === -1) {
      newPriorities.push(value)
    } else {
      newPriorities.splice(index, 1)
    }
    
    setLocalFilters({
      ...localFilters,
      priority: newPriorities
    })
  }

  // Función para actualizar estados de completado
  const handleCompletionStatusChange = (value: string) => {
    const newCompletionStatus = [...localFilters.completionStatus]
    const index = newCompletionStatus.indexOf(value)
    
    if (index === -1) {
      newCompletionStatus.push(value)
    } else {
      newCompletionStatus.splice(index, 1)
    }
    
    setLocalFilters({
      ...localFilters,
      completionStatus: newCompletionStatus
    })
  }

  // Función para actualizar segmentos
  const handleSegmentChange = (value: string) => {
    const newSegments = [...localFilters.segments]
    const index = newSegments.indexOf(value)
    
    if (index === -1) {
      newSegments.push(value)
    } else {
      newSegments.splice(index, 1)
    }
    
    setLocalFilters({
      ...localFilters,
      segments: newSegments
    })
  }

  // Resetear todos los filtros
  const handleResetFilters = () => {
    setLocalFilters({
      priority: [],
      completionStatus: [],
      segments: []
    })
  }

  // Aplicar los filtros y cerrar modal
  const handleApplyFilters = () => {
    onApplyFilters(localFilters)
    onClose()
  }

  // Obtener el total de filtros aplicados
  const getTotalActiveFilters = () => {
    return localFilters.priority.length + localFilters.completionStatus.length + localFilters.segments.length
  }

  // Función para renderizar el icono de prioridad
  const getPriorityIcon = (priority: string) => {
    if (priority === "high") return <Tag className="h-4 w-4 text-red-500" />
    if (priority === "medium") return <Tag className="h-4 w-4 text-amber-500" />
    if (priority === "low") return <Tag className="h-4 w-4 text-blue-500" />
    return null
  }

  // Función para renderizar el icono de estado de completado
  const getCompletionStatusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-green-500" />
    if (status === "rejected") return <Ban className="h-4 w-4 text-red-500" />
    if (status === "pending") return <RotateCcw className="h-4 w-4 text-amber-500" />
    return null
  }

  // Para obtener las clases de color de prioridad
  const getPriorityBadgeClass = (priority: string) => {
    if (priority === "high") return "bg-red-100 text-red-800 hover:bg-red-200"
    if (priority === "medium") return "bg-amber-100 text-amber-800 hover:bg-amber-200"
    if (priority === "low") return "bg-blue-100 text-blue-800 hover:bg-blue-200"
    return ""
  }

  // Para obtener las clases de color de estado de completado
  const getCompletionStatusBadgeClass = (status: string) => {
    if (status === "completed") return "bg-green-100 text-green-800 hover:bg-green-200"
    if (status === "rejected") return "bg-red-100 text-red-800 hover:bg-red-200"
    if (status === "pending") return "bg-amber-100 text-amber-800 hover:bg-amber-200"
    return ""
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-700" />
            <DialogTitle className="text-xl">Filter Requirements</DialogTitle>
          </div>
          <DialogDescription className="mt-1.5">
            Select filters to narrow down your requirement list.
          </DialogDescription>
        </DialogHeader>
        
        {/* Contador de filtros activos */}
        {getTotalActiveFilters() > 0 && (
          <div className="px-6 pt-2">
            <div className="flex items-center">
              <span className="text-sm text-muted-foreground">
                Active filters: 
              </span>
              <Badge variant="secondary" className="ml-2 font-medium">
                {getTotalActiveFilters()}
              </Badge>
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-auto h-8 px-2 text-muted-foreground hover:text-foreground"
                onClick={handleResetFilters}
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Reset all
              </Button>
            </div>
          </div>
        )}
        
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            {/* Filtro de prioridad */}
            <div className="space-y-3">
              <div className="flex items-center">
                <ChevronUp className="h-4 w-4 text-muted-foreground mr-2" />
                <h3 className="font-medium text-sm text-foreground">Priority</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {["high", "medium", "low"].map((priority) => (
                  <button
                    key={priority}
                    onClick={() => handlePriorityChange(priority)}
                    className={`
                      flex items-center px-3 py-1.5 rounded-full text-sm font-medium
                      transition-colors duration-200
                      ${localFilters.priority.includes(priority) 
                        ? getPriorityBadgeClass(priority)
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
                    `}
                  >
                    {getPriorityIcon(priority)}
                    <span className="ml-1.5 capitalize">{priority}</span>
                    {localFilters.priority.includes(priority) && (
                      <X className="ml-1 h-3.5 w-3.5 text-current opacity-70" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="h-px w-full bg-gray-200"></div>
            
            {/* Filtro de estado de completado */}
            <div className="space-y-3">
              <div className="flex items-center">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground mr-2" />
                <h3 className="font-medium text-sm text-foreground">Completion Status</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {completionStatusOptions.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleCompletionStatusChange(status)}
                    className={`
                      flex items-center px-3 py-1.5 rounded-full text-sm font-medium
                      transition-colors duration-200
                      ${localFilters.completionStatus.includes(status) 
                        ? getCompletionStatusBadgeClass(status) 
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}
                    `}
                  >
                    {getCompletionStatusIcon(status)}
                    <span className="ml-1.5 capitalize">{status}</span>
                    {localFilters.completionStatus.includes(status) && (
                      <X className="ml-1 h-3.5 w-3.5 text-current opacity-70" />
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {segments.length > 0 && (
              <>
                <div className="h-px w-full bg-gray-200"></div>
                
                {/* Filtro de segmentos con switches */}
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Users className="h-4 w-4 text-muted-foreground mr-2" />
                    <h3 className="font-medium text-sm text-foreground">Segments</h3>
                  </div>
                  <div className="space-y-2">
                    {segments.map((segment) => (
                      <div 
                        key={segment.id} 
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200"
                      >
                        <Label 
                          htmlFor={`segment-${segment.id}`}
                          className="cursor-pointer flex-1 truncate"
                        >
                          {segment.name}
                        </Label>
                        <Switch 
                          id={`segment-${segment.id}`} 
                          checked={localFilters.segments.includes(segment.id)}
                          onCheckedChange={() => handleSegmentChange(segment.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        
        <DialogFooter className="p-6 pt-4 border-t flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="gap-2"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            onClick={handleApplyFilters}
            className="gap-2"
          >
            <Filter className="h-4 w-4" />
            Apply Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 