"use client"

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
import { Combobox } from "@/app/components/ui/combobox"
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
  Clock,
  User
} from "@/app/components/ui/icons"

// Define task stages based on journey stages
const TASK_STAGES = [
  { id: "awareness", name: "Awareness" },
  { id: "consideration", name: "Consideration" },
  { id: "decision", name: "Decision" },
  { id: "purchase", name: "Purchase" },
  { id: "retention", name: "Retention" },
  { id: "referral", name: "Referral" }
]

// Define task statuses
const TASK_STATUSES = [
  { id: "pending", name: "Pending" },
  { id: "in_progress", name: "In Progress" },
  { id: "completed", name: "Completed" },
  { id: "failed", name: "Failed" },
  { id: "canceled", name: "Canceled" }
]

// Define tipos para los filtros
export interface TaskFilters {
  stage: string[]
  status: string[]
  leadId: string[]
  assigneeId: string[]
}

interface TaskFilterModalProps {
  isOpen: boolean
  onClose: () => void
  filters: TaskFilters
  onApplyFilters: (filters: TaskFilters) => void
  leads: Array<{ id: string; name: string }>
  users: Array<{ id: string; name: string }>
}

export function TaskFilterModal({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  leads,
  users
}: TaskFilterModalProps) {
  // Estado local para los filtros
  const [localFilters, setLocalFilters] = React.useState<TaskFilters>({
    stage: [...filters.stage],
    status: [...filters.status],
    leadId: [...filters.leadId],
    assigneeId: [...filters.assigneeId]
  })

  // Estado para las secciones expandidas
  const [expandedSections, setExpandedSections] = React.useState({
    stage: true,
    status: true,
    lead: true,
    assignee: true
  })

  // Resetear los filtros locales cuando cambia el estado isOpen
  React.useEffect(() => {
    if (isOpen) {
      setLocalFilters(filters)
    }
  }, [isOpen, filters])

  // Función para cambiar el estado de una sección
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Función para actualizar stages
  const handleStageChange = (value: string) => {
    setLocalFilters(prev => {
      if (prev.stage.includes(value)) {
        return {
          ...prev,
          stage: prev.stage.filter(s => s !== value)
        }
      } else {
        return {
          ...prev,
          stage: [...prev.stage, value]
        }
      }
    })
  }

  // Función para actualizar status
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

  // Función para actualizar leads
  const handleLeadChange = (value: string) => {
    setLocalFilters(prev => {
      if (prev.leadId.includes(value)) {
        return {
          ...prev,
          leadId: prev.leadId.filter(l => l !== value)
        }
      } else {
        return {
          ...prev,
          leadId: [...prev.leadId, value]
        }
      }
    })
  }

  // Función para actualizar assignees
  const handleAssigneeChange = (value: string) => {
    setLocalFilters(prev => {
      if (prev.assigneeId.includes(value)) {
        return {
          ...prev,
          assigneeId: prev.assigneeId.filter(a => a !== value)
        }
      } else {
        return {
          ...prev,
          assigneeId: [...prev.assigneeId, value]
        }
      }
    })
  }

  // Función para resetear filtros
  const handleResetFilters = () => {
    setLocalFilters({
      stage: [],
      status: [],
      leadId: [],
      assigneeId: []
    })
  }

  // Aplicar filtros y cerrar el modal
  const handleApplyFilters = () => {
    onApplyFilters(localFilters)
    onClose()
  }

  // Contar el total de filtros activos
  const getTotalActiveFilters = () => {
    return localFilters.stage.length + 
           localFilters.status.length +
           localFilters.leadId.length + 
           localFilters.assigneeId.length
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter Tasks
          </DialogTitle>
          <DialogDescription>
            Apply filters to narrow down your tasks list.
            {getTotalActiveFilters() > 0 && (
              <Badge variant="outline" className="ml-2">
                {getTotalActiveFilters()} active filters
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Stage Filter */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => toggleSection('stage')}
            >
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Stage</h3>
                {localFilters.stage.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {localFilters.stage.length}
                  </Badge>
                )}
              </div>
              {expandedSections.stage ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {expandedSections.stage && (
              <div className="px-3 py-[10px] border-t">
                <div className="grid grid-cols-2 gap-2">
                  {TASK_STAGES.map(stage => (
                    <div key={stage.id} className="flex items-center space-x-2">
                      <Switch 
                        id={`stage-${stage.id}`}
                        checked={localFilters.stage.includes(stage.id)}
                        onCheckedChange={() => handleStageChange(stage.id)}
                      />
                      <Label 
                        htmlFor={`stage-${stage.id}`}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{stage.name}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => toggleSection('status')}
            >
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
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
                  {TASK_STATUSES.map(status => (
                    <div key={status.id} className="flex items-center space-x-2">
                      <Switch 
                        id={`status-${status.id}`}
                        checked={localFilters.status.includes(status.id)}
                        onCheckedChange={() => handleStatusChange(status.id)}
                      />
                      <Label 
                        htmlFor={`status-${status.id}`}
                        className="flex items-center gap-1.5 cursor-pointer"
                      >
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="capitalize">{status.name}</span>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Lead Filter */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => toggleSection('lead')}
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Lead</h3>
                {localFilters.leadId.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {localFilters.leadId.length}
                  </Badge>
                )}
              </div>
              {expandedSections.lead ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {expandedSections.lead && (
              <div className="px-3 py-[10px] border-t">
                <div className="space-y-2">
                  {localFilters.leadId.map(leadId => {
                    const lead = leads.find(l => l.id === leadId)
                    if (!lead) return null
                    return (
                      <div key={lead.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{lead.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLeadChange(lead.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                  <Combobox
                    options={leads.map(lead => ({ value: lead.id, label: lead.name }))}
                    value=""
                    onValueChange={handleLeadChange}
                    placeholder="Search leads..."
                    emptyMessage="No leads found"
                    icon={<User className="h-4 w-4" />}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Assignee Filter */}
          <div className="border rounded-lg">
            <div 
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => toggleSection('assignee')}
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Assignee</h3>
                {localFilters.assigneeId.length > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {localFilters.assigneeId.length}
                  </Badge>
                )}
              </div>
              {expandedSections.assignee ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>

            {expandedSections.assignee && (
              <div className="px-3 py-[10px] border-t">
                <div className="space-y-2">
                  {localFilters.assigneeId.map(assigneeId => {
                    const user = users.find(u => u.id === assigneeId)
                    if (!user) return null
                    return (
                      <div key={user.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{user.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAssigneeChange(user.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                  <Combobox
                    options={users.map(user => ({ value: user.id, label: user.name }))}
                    value=""
                    onValueChange={handleAssigneeChange}
                    placeholder="Search users..."
                    emptyMessage="No users found"
                    icon={<Users className="h-4 w-4" />}
                  />
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