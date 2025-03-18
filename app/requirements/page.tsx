"use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Checkbox } from "@/app/components/ui/checkbox"
import { PlusCircle, Filter, Search, ChevronDown, ChevronUp, XCircle, Check, Archive, RotateCcw, CheckCircle2, Ban, ClipboardList } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { Collapsible, CollapsibleContent } from "@/app/components/ui/collapsible"
import React, { useState, useEffect } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyState } from "@/app/components/ui/empty-state"
import { useToast } from "@/app/components/ui/use-toast"
import { CreateRequirementDialog } from "@/app/components/create-requirement-dialog"
import { createRequirement, updateRequirementStatus, updateCompletionStatus, updateRequirementPriority } from "./actions"
import { createClient } from "@/lib/supabase/client"
import { useSite } from "@/app/context/SiteContext"
import { type Segment } from "./types"
import { SearchInput } from "@/app/components/ui/search-input"
import { FilterModal, type RequirementFilters } from "@/app/components/ui/filter-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/app/components/ui/dropdown-menu"

// Constantes para estados
const REQUIREMENT_STATUS = {
  VALIDATED: "validated",
  IN_PROGRESS: "in-progress",
  ON_REVIEW: "on-review",
  DONE: "done",
  BACKLOG: "backlog",
  CANCELED: "canceled"
} as const;

const COMPLETION_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  REJECTED: "rejected"
} as const;

type RequirementStatusType = typeof REQUIREMENT_STATUS[keyof typeof REQUIREMENT_STATUS];
type CompletionStatusType = typeof COMPLETION_STATUS[keyof typeof COMPLETION_STATUS];

interface Requirement {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  status: RequirementStatusType
  completionStatus: CompletionStatusType
  source: string
  createdAt: string
  segments: string[]
  segmentNames?: string[]
}

// Define el tipo para los datos de requisitos en Supabase
interface RequirementData {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  status: RequirementStatusType
  completion_status: CompletionStatusType
  source: string
  created_at: string
  requirement_segments: Array<{ segment_id: string }> | null
}

// Define la interfaz para el segmento en Supabase
interface SegmentData {
  id: string
  name: string
  description: string
}

function RequirementCard({ requirement, onUpdateStatus, onUpdateCompletionStatus, onUpdatePriority }: { 
  requirement: Requirement, 
  onUpdateStatus: (id: string, status: RequirementStatusType) => Promise<void>,
  onUpdateCompletionStatus: (id: string, status: CompletionStatusType) => Promise<void>,
  onUpdatePriority: (id: string, priority: "high" | "medium" | "low") => Promise<void>
}) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isUpdatingCompletion, setIsUpdatingCompletion] = useState(false)
  const [isUpdatingPriority, setIsUpdatingPriority] = useState(false)
  const { toast } = useToast()

  const priorityColors = {
    high: "bg-red-100/20 text-red-600 dark:text-red-400 hover:bg-red-100/30 border-red-300/30",
    medium: "bg-yellow-100/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100/30 border-yellow-300/30",
    low: "bg-blue-100/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/30 border-blue-300/30"
  }

  const statusColors = {
    [REQUIREMENT_STATUS.VALIDATED]: "bg-green-100/20 text-green-600 dark:text-green-400 hover:bg-green-100/30 border-green-300/30",
    [REQUIREMENT_STATUS.IN_PROGRESS]: "bg-purple-100/20 text-purple-600 dark:text-purple-400 hover:bg-purple-100/30 border-purple-300/30",
    [REQUIREMENT_STATUS.ON_REVIEW]: "bg-blue-100/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/30 border-blue-300/30",
    [REQUIREMENT_STATUS.DONE]: "bg-green-100/20 text-green-600 dark:text-green-400 hover:bg-green-100/30 border-green-300/30",
    [REQUIREMENT_STATUS.BACKLOG]: "bg-gray-100/20 text-gray-600 dark:text-gray-400 hover:bg-gray-100/30 border-gray-300/30",
    [REQUIREMENT_STATUS.CANCELED]: "bg-red-100/20 text-red-600 dark:text-red-400 hover:bg-red-100/30 border-red-300/30"
  }

  const completionStatusColors = {
    [COMPLETION_STATUS.COMPLETED]: "bg-green-100/20 text-green-600 dark:text-green-400 border-green-300/30",
    [COMPLETION_STATUS.REJECTED]: "bg-red-100/20 text-red-600 dark:text-red-400 border-red-300/30",
    [COMPLETION_STATUS.PENDING]: "bg-yellow-100/20 text-yellow-600 dark:text-yellow-400 border-yellow-300/30"
  }

  const handleUpdateStatus = async (status: RequirementStatusType) => {
    try {
      setIsUpdatingStatus(true)
      await onUpdateStatus(requirement.id, status)
      toast({
        title: "Status updated",
        description: `The requirement has been moved to ${
          status === REQUIREMENT_STATUS.VALIDATED ? "Validated" : 
          status === REQUIREMENT_STATUS.IN_PROGRESS ? "In Progress" :
          status === REQUIREMENT_STATUS.ON_REVIEW ? "On Review" :
          status === REQUIREMENT_STATUS.DONE ? "Done" :
          status === REQUIREMENT_STATUS.CANCELED ? "Canceled" :
          "Backlog"
        }`,
      })
    } catch (error) {
      toast({
        title: "Error",
        variant: "destructive",
        description: "Error al actualizar el estado del requisito",
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleUpdateCompletionStatus = async (status: CompletionStatusType) => {
    try {
      setIsUpdatingCompletion(true)
      await onUpdateCompletionStatus(requirement.id, status)
      toast({
        title: "Estado actualizado",
        description: `El estado de finalización ha sido actualizado a ${
          status === COMPLETION_STATUS.PENDING ? "Pendiente" : 
          status === COMPLETION_STATUS.COMPLETED ? "Completado" : 
          "Rechazado"
        }`,
      })
    } catch (error) {
      toast({
        title: "Error",
        variant: "destructive",
        description: "Error al actualizar el estado de finalización",
      })
    } finally {
      setIsUpdatingCompletion(false)
    }
  }

  const handleUpdatePriority = async (priority: "high" | "medium" | "low") => {
    try {
      setIsUpdatingPriority(true)
      await onUpdatePriority(requirement.id, priority)
      toast({
        title: "Priority updated",
        description: `The requirement priority has been updated to ${
          priority === "high" ? "High" : 
          priority === "medium" ? "Medium" : "Low"
        }`,
      })
    } catch (error) {
      toast({
        title: "Error",
        variant: "destructive",
        description: "Error al actualizar la prioridad del requisito",
      })
    } finally {
      setIsUpdatingPriority(false)
    }
  }

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="w-full"
    >
      <div 
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Card className="border border-border hover:border-foreground/20 transition-colors overflow-hidden">
          <div className="flex items-center pl-6 hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-center p-2">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <CardContent className="flex-1 p-6 flex flex-col lg:flex-row items-start lg:items-center gap-4">
              <div className="w-full lg:w-1/4 min-w-[200px] max-w-full lg:max-w-[300px] mb-4 lg:mb-0">
                <h3 className="font-semibold text-lg truncate">{requirement.title}</h3>
                <p className="text-sm text-muted-foreground/80 truncate">{requirement.description}</p>
              </div>
              <div className="flex flex-wrap gap-6 w-full lg:w-3/4 justify-start lg:justify-between">
                <div className="min-w-[120px] sm:min-w-[100px] p-2 rounded-lg">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Priority</p>
                  {requirement.completionStatus === COMPLETION_STATUS.COMPLETED || requirement.completionStatus === COMPLETION_STATUS.REJECTED ? (
                    <Badge 
                      variant="secondary" 
                      className={`${priorityColors[requirement.priority]} bg-opacity-30 hover:bg-opacity-30 cursor-not-allowed`}
                    >
                      {requirement.priority.charAt(0).toUpperCase() + requirement.priority.slice(1)}
                    </Badge>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                          <Badge variant="secondary" className={priorityColors[requirement.priority]}>
                            {requirement.priority.charAt(0).toUpperCase() + requirement.priority.slice(1)}
                          </Badge>
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          disabled={isUpdatingPriority}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdatePriority("high");
                          }}
                        >
                          <div className="w-2 h-2 rounded-full mr-2 bg-red-500"></div>
                          High Priority
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          disabled={isUpdatingPriority}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdatePriority("medium");
                          }}
                        >
                          <div className="w-2 h-2 rounded-full mr-2 bg-yellow-500"></div>
                          Medium Priority
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          disabled={isUpdatingPriority}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdatePriority("low");
                          }}
                        >
                          <div className="w-2 h-2 rounded-full mr-2 bg-blue-500"></div>
                          Low Priority
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {isUpdatingPriority && (
                    <span className="text-xs text-muted-foreground animate-pulse block mt-1">Updating...</span>
                  )}
                </div>
                <div className="min-w-[120px] sm:min-w-[100px] p-2 rounded-lg">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Status</p>
                  {requirement.completionStatus === COMPLETION_STATUS.COMPLETED || requirement.completionStatus === COMPLETION_STATUS.REJECTED ? (
                    <Badge 
                      variant="secondary" 
                      className={`${statusColors[requirement.status]} bg-opacity-30 hover:bg-opacity-30 cursor-not-allowed`}
                    >
                      {requirement.status === REQUIREMENT_STATUS.IN_PROGRESS 
                        ? "In Progress" 
                        : requirement.status === REQUIREMENT_STATUS.ON_REVIEW
                          ? "On Review"
                          : requirement.status === REQUIREMENT_STATUS.DONE
                            ? "Done"
                            : requirement.status === REQUIREMENT_STATUS.CANCELED
                              ? "Canceled"
                              : requirement.status === REQUIREMENT_STATUS.VALIDATED
                                ? "Validated"
                                : "Backlog"}
                    </Badge>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
                          <Badge variant="secondary" className={statusColors[requirement.status]}>
                            {requirement.status === REQUIREMENT_STATUS.IN_PROGRESS 
                              ? "In Progress" 
                              : requirement.status === REQUIREMENT_STATUS.ON_REVIEW
                                ? "On Review"
                                : requirement.status === REQUIREMENT_STATUS.DONE
                                  ? "Done"
                                  : requirement.status === REQUIREMENT_STATUS.CANCELED
                                    ? "Canceled"
                                    : requirement.status === REQUIREMENT_STATUS.VALIDATED
                                      ? "Validated"
                                      : "Backlog"}
                          </Badge>
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48">
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          disabled={isUpdatingStatus}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(REQUIREMENT_STATUS.BACKLOG);
                          }}
                        >
                          <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.BACKLOG].split(" ")[0]}`}></div>
                          Backlog
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          disabled={isUpdatingStatus}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(REQUIREMENT_STATUS.IN_PROGRESS);
                          }}
                        >
                          <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.IN_PROGRESS].split(" ")[0]}`}></div>
                          In Progress
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          disabled={isUpdatingStatus}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(REQUIREMENT_STATUS.ON_REVIEW);
                          }}
                        >
                          <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.ON_REVIEW].split(" ")[0]}`}></div>
                          On Review
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          disabled={isUpdatingStatus}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(REQUIREMENT_STATUS.DONE);
                          }}
                        >
                          <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.DONE].split(" ")[0]}`}></div>
                          Done
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          disabled={isUpdatingStatus}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(REQUIREMENT_STATUS.VALIDATED);
                          }}
                        >
                          <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.VALIDATED].split(" ")[0]}`}></div>
                          Validated
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer"
                          disabled={isUpdatingStatus}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateStatus(REQUIREMENT_STATUS.CANCELED);
                          }}
                        >
                          <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.CANCELED].split(" ")[0]}`}></div>
                          Canceled
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {isUpdatingStatus && (
                    <span className="text-xs text-muted-foreground animate-pulse block mt-1">Updating...</span>
                  )}
                </div>
                <div className="min-w-[120px] sm:min-w-[100px] p-2 rounded-lg">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Source</p>
                  <p className="text-sm font-medium truncate">{requirement.source}</p>
                </div>
                <div className="min-w-[120px] sm:min-w-[100px] p-2 rounded-lg">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Created</p>
                  <p className="text-sm font-medium">{new Date(requirement.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="min-w-[140px] sm:min-w-[120px] p-2 rounded-lg">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Completion</p>
                  <div className={`px-3 py-1 text-sm font-medium rounded-md border text-center ${completionStatusColors[requirement.completionStatus]}`}>
                    {requirement.completionStatus.charAt(0).toUpperCase() + requirement.completionStatus.slice(1)}
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <CollapsibleContent>
            <CardContent className="pt-6 pb-6 px-6 border-t" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-6">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <div className="font-medium text-sm">Description</div>
                    <div className="text-sm text-muted-foreground">{requirement.description}</div>
                  </div>
                  <div className="grid gap-2">
                    <div className="font-medium text-sm">Segments</div>
                    <div className="flex flex-wrap gap-2">
                      {requirement.segmentNames?.map((segment) => (
                        <Badge
                          key={segment}
                          variant="secondary"
                          className="px-3 py-1 text-xs font-medium bg-gray-100/20 text-gray-700 dark:text-gray-300 hover:bg-gray-200/20 transition-colors border border-gray-300/30"
                        >
                          {segment}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 mt-6">
                  {requirement.completionStatus === COMPLETION_STATUS.PENDING && (
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className={`flex items-center gap-2 w-auto ${statusColors[requirement.status]} px-4 py-2 border-border transition-all duration-200 shadow-sm`}
                          >
                            <span className="font-medium">
                              {requirement.status === REQUIREMENT_STATUS.IN_PROGRESS 
                                ? "In Progress" 
                                : requirement.status === REQUIREMENT_STATUS.ON_REVIEW
                                  ? "On Review"
                                  : requirement.status === REQUIREMENT_STATUS.DONE
                                    ? "Done"
                                    : requirement.status === REQUIREMENT_STATUS.CANCELED
                                      ? "Canceled"
                                      : requirement.status === REQUIREMENT_STATUS.VALIDATED
                                        ? "Validated"
                                        : "Backlog"}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-70" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            disabled={isUpdatingStatus}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(REQUIREMENT_STATUS.BACKLOG);
                            }}
                          >
                            <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.BACKLOG].split(" ")[0]}`}></div>
                            Backlog
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            disabled={isUpdatingStatus}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(REQUIREMENT_STATUS.IN_PROGRESS);
                            }}
                          >
                            <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.IN_PROGRESS].split(" ")[0]}`}></div>
                            In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            disabled={isUpdatingStatus}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(REQUIREMENT_STATUS.ON_REVIEW);
                            }}
                          >
                            <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.ON_REVIEW].split(" ")[0]}`}></div>
                            On Review
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            disabled={isUpdatingStatus}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(REQUIREMENT_STATUS.DONE);
                            }}
                          >
                            <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.DONE].split(" ")[0]}`}></div>
                            Done
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            disabled={isUpdatingStatus}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(REQUIREMENT_STATUS.VALIDATED);
                            }}
                          >
                            <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.VALIDATED].split(" ")[0]}`}></div>
                            Validated
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            disabled={isUpdatingStatus}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdateStatus(REQUIREMENT_STATUS.CANCELED);
                            }}
                          >
                            <div className={`w-2 h-2 rounded-full mr-2 ${statusColors[REQUIREMENT_STATUS.CANCELED].split(" ")[0]}`}></div>
                            Canceled
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {isUpdatingStatus && (
                        <span className="text-sm text-muted-foreground animate-pulse self-center">Updating...</span>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className={`flex items-center gap-2 w-auto 
                              ${requirement.priority === "high" 
                                ? "bg-red-100/20 text-red-600 dark:text-red-400 hover:bg-red-100/30 border-red-300/30" 
                                : requirement.priority === "medium"
                                  ? "bg-yellow-100/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100/30 border-yellow-300/30"
                                  : "bg-blue-100/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100/30 border-blue-300/30"
                              } px-4 py-2 border-border transition-all duration-200 shadow-sm`}
                          >
                            <span className="font-medium">
                              {requirement.priority === "high" 
                                ? "High Priority" 
                                : requirement.priority === "medium"
                                  ? "Medium Priority"
                                  : "Low Priority"}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-70" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            disabled={isUpdatingPriority}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdatePriority("high");
                            }}
                          >
                            <div className="w-2 h-2 rounded-full mr-2 bg-red-500"></div>
                            High Priority
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            disabled={isUpdatingPriority}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdatePriority("medium");
                            }}
                          >
                            <div className="w-2 h-2 rounded-full mr-2 bg-yellow-500"></div>
                            Medium Priority
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="cursor-pointer"
                            disabled={isUpdatingPriority}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdatePriority("low");
                            }}
                          >
                            <div className="w-2 h-2 rounded-full mr-2 bg-blue-500"></div>
                            Low Priority
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {isUpdatingPriority && (
                        <span className="text-sm text-muted-foreground animate-pulse self-center">Updating...</span>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto bg-green-100/20 hover:bg-green-100/30 text-green-600 dark:text-green-400 border-green-300/30 transition-all duration-200 shadow-sm"
                        onClick={async (e) => {
                          e.stopPropagation()
                          // Update both status and completion status
                          setIsUpdatingCompletion(true)
                          setIsUpdatingStatus(true)
                          try {
                            await handleUpdateStatus(REQUIREMENT_STATUS.DONE)
                            await handleUpdateCompletionStatus(COMPLETION_STATUS.COMPLETED)
                          } finally {
                            setIsUpdatingCompletion(false)
                            setIsUpdatingStatus(false)
                          }
                          toast({
                            title: "Requirement completed",
                            description: "The requirement has been marked as done and completed",
                          })
                        }}
                        disabled={isUpdatingStatus || isUpdatingCompletion}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Mark as Done</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto bg-red-100/20 hover:bg-red-100/30 text-red-600 dark:text-red-400 border-red-300/30 transition-all duration-200 shadow-sm"
                        onClick={async (e) => {
                          e.stopPropagation()
                          // Update both status and completion status
                          setIsUpdatingCompletion(true)
                          setIsUpdatingStatus(true)
                          try {
                            await handleUpdateStatus(REQUIREMENT_STATUS.CANCELED)
                            await handleUpdateCompletionStatus(COMPLETION_STATUS.REJECTED)
                          } finally {
                            setIsUpdatingCompletion(false)
                            setIsUpdatingStatus(false)
                          }
                          toast({
                            title: "Requirement rejected",
                            description: "The requirement has been rejected",
                          })
                        }}
                        disabled={isUpdatingStatus || isUpdatingCompletion}
                      >
                        <Ban className="h-4 w-4" />
                        <span className="font-medium">Reject</span>
                      </Button>
                    </>
                  )}
                  {requirement.completionStatus === COMPLETION_STATUS.COMPLETED && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto bg-amber-100/20 hover:bg-amber-100/30 text-amber-600 dark:text-amber-400 border-amber-300/30 transition-all duration-200 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpdateCompletionStatus(COMPLETION_STATUS.PENDING)
                        }}
                        disabled={isUpdatingStatus || isUpdatingCompletion}
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span className="font-medium">Return to Pending</span>
                      </Button>
                    </>
                  )}
                  {requirement.completionStatus === COMPLETION_STATUS.REJECTED && (
                    <>
                      {isUpdatingStatus && (
                        <span className="text-sm text-muted-foreground animate-pulse self-center">Updating...</span>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto bg-amber-100/20 hover:bg-amber-100/30 text-amber-600 dark:text-amber-400 border-amber-300/30 transition-all duration-200 shadow-sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUpdateCompletionStatus(COMPLETION_STATUS.PENDING)
                        }}
                        disabled={isUpdatingStatus || isUpdatingCompletion}
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span className="font-medium">Return to Pending</span>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </div>
    </Collapsible>
  )
}

/**
 * Limpia un UUID de comillas extras o caracteres no válidos
 * @param id Posible UUID con formato incorrecto
 * @returns UUID limpio o string vacía si no es válido
 */
function cleanUUID(id: string | null): string {
  if (!id) return "";
  
  // Eliminar comillas extras si existen
  let cleaned = id.replace(/["']/g, '')
  
  // Verificar el formato básico de UUID después de limpiar
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned)) {
    return cleaned
  }
  
  // Caso especial para "default" u otros valores especiales
  if (cleaned === "default") return cleaned
  
  console.warn("UUID inválido después de limpieza:", id, "->", cleaned)
  return ""
}

// Define tipos para la caché (fuera del componente)
type CacheData = {
  segments: Segment[],
  requirements: Requirement[],
  timestamp: number,
  lastUpdated: number
};

type CacheStore = {
  [key: string]: CacheData;
};

export default function RequirementsPage() {
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [filteredRequirements, setFilteredRequirements] = useState<Requirement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Estado de filtros avanzados
  const [filters, setFilters] = useState<RequirementFilters>({
    priority: [],
    completionStatus: [],
    status: [],
    segments: []
  })
  
  // Estado para controlar la visualización del modal de filtros
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  
  // Estado de error visible al usuario
  const [visibleError, setVisibleError] = useState<string | null>(null)
  
  // Usar refs para los estados que no necesitan re-renderizar el componente
  const loadAttemptsRef = React.useRef(0)
  const isMountedRef = React.useRef(true)
  const isLoadingDataRef = React.useRef(false)
  const siteLoadedRef = React.useRef<string | null>(null)
  
  // Referencia para guardar el caché por sitio con sistema de invalidación basado en tiempo
  const dataCacheBySiteRef = React.useRef<CacheStore>({});
  
  // Para la referencia al input de búsqueda
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  
  const { toast } = useToast()
  const { currentSite } = useSite()
  
  // Funciones de utilidad para manejar la caché de forma segura
  const getCacheForSite = (siteId: string): CacheData | null => {
    if (!siteId || typeof siteId !== 'string') return null;
    return dataCacheBySiteRef.current[siteId] || null;
  };
  
  const setCacheForSite = (siteId: string, data: CacheData): void => {
    if (!siteId || typeof siteId !== 'string') return;
    dataCacheBySiteRef.current[siteId] = data;
  };
  
  // Forzar una recarga de datos (útil después de operaciones de actualización)
  const invalidateCache = React.useCallback((siteId: string): void => {
    if (!siteId || typeof siteId !== 'string') return;
    
    const cache = getCacheForSite(siteId);
    if (cache) {
      setCacheForSite(siteId, {
        ...cache,
        lastUpdated: 0
      });
    }
  }, []);

  // Configurar cleanup al desmontar
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Efecto de carga de datos (simplificado)
  useEffect(() => {
    // Si no hay sitio seleccionado, no cargamos nada
    if (!currentSite) {
      setIsLoading(false);
      return;
    }
    
    // Si el ID del sitio no es válido, mostramos error
    const siteId = currentSite?.id;
    if (!siteId) {
      setVisibleError("Invalid site ID");
      setIsLoading(false);
      return;
    }
    
    // Función de carga simplificada
    const loadDataSimple = async () => {
      try {
        const supabase = createClient();
        
        // Verify that the site exists
        const { data: siteData, error: siteError } = await supabase
          .from("sites")
          .select("id, name")
          .eq("id", siteId)
          .single();
          
        if (siteError || !siteData) {
          throw new Error("The selected site does not exist or you don't have access to it");
        }
        
        // Load segments
        const { data: segmentData, error: segmentError } = await supabase
          .from("segments")
          .select("*")
          .eq("site_id", siteId);
        
        if (segmentError) {
          throw new Error(`Error loading segments: ${segmentError.message}`);
        }
        
        // Load requirements - FIXING THE QUERY
        const { data: requirementData, error: requirementError } = await supabase
          .from("requirements")
          .select("*, requirement_segments(segment_id)")
          .eq("site_id", siteId);
        
        if (requirementError) {
          throw new Error(`Error loading requirements: ${requirementError.message}`);
        }
        
        // Map segments to expected format
        const segments = (segmentData || []).map((segment: SegmentData) => ({
          id: segment.id,
          name: segment.name,
          description: segment.description || "",
        }));
        
        // Map requirements to expected format
        const requirements = (requirementData || []).map((req: any) => {
          // Extract related segment IDs
          const segmentIds = (req.requirement_segments || []).map((sr: any) => sr.segment_id);
          
          // Get segment names
          const segmentNames = segments
            .filter((segment: SegmentData) => segmentIds.includes(segment.id))
            .map((segment: SegmentData) => segment.name);
          
          return {
            id: req.id,
            title: req.title,
            description: req.description || "",
            priority: req.priority || "medium",
            status: req.status || "backlog",
            completionStatus: req.completion_status || "pending",
            source: req.source || "",
            createdAt: req.created_at || new Date().toISOString(),
            segments: segmentIds,
            segmentNames: segmentNames
          };
        });
        
        // Update state
        setSegments(segments);
        setRequirements(requirements);
        
        // Reset loading state
        setIsLoading(false);
        
      } catch (error: any) {
        setVisibleError(error.message || "Error loading data");
        setIsLoading(false);
      }
    };
    
    setIsLoading(true);
    loadDataSimple();
    
    return () => {
      // Limpieza
    };
  }, [currentSite]);

  // Manejar actualización de estados con invalidación de caché
  const handleUpdateStatus = async (id: string, status: RequirementStatusType) => {
    try {
      const { error } = await updateRequirementStatus(id, status)
      
      if (error) {
        throw new Error(error)
      }
      
      // Actualizar el estado local
      setRequirements(prevReqs => 
        prevReqs.map(req => 
          req.id === id ? { ...req, status } : req
        )
      )
      
      // Invalidar caché si hay un sitio seleccionado
      if (currentSite?.id) {
        const siteId = cleanUUID(currentSite.id);
        if (siteId) {
          invalidateCache(siteId);
        }
      }
      
    } catch (error) {
      console.error("Error al actualizar el estado:", error)
      toast({
        title: "Error",
        variant: "destructive",
        description: error instanceof Error ? error.message : "Error al actualizar el estado",
      })
      throw error
    }
  }

  // Manejar actualización de estados de finalización con invalidación de caché
  const handleUpdateCompletionStatus = async (id: string, completionStatus: CompletionStatusType) => {
    try {
      const { error } = await updateCompletionStatus(id, completionStatus)
      
      if (error) {
        throw new Error(error)
      }
      
      // Actualizar el estado local
      setRequirements(prevReqs => 
        prevReqs.map(req => 
          req.id === id ? { ...req, completionStatus } : req
        )
      )
      
      // Invalidar caché si hay un sitio seleccionado
      if (currentSite?.id) {
        const siteId = cleanUUID(currentSite.id);
        if (siteId) {
          invalidateCache(siteId);
        }
      }
      
    } catch (error) {
      console.error("Error al actualizar el estado de finalización:", error)
      toast({
        title: "Error",
        variant: "destructive",
        description: error instanceof Error ? error.message : "Error al actualizar el estado de finalización",
      })
      throw error
    }
  }

  // Manejar actualización de prioridad con invalidación de caché
  const handleUpdatePriority = async (id: string, priority: "high" | "medium" | "low") => {
    try {
      const { error } = await updateRequirementPriority(id, priority)
      
      if (error) {
        throw new Error(error)
      }
      
      // Actualizar el estado local
      setRequirements(prevReqs => 
        prevReqs.map(req => 
          req.id === id ? { ...req, priority } : req
        )
      )
      
      // Invalidar caché si hay un sitio seleccionado
      if (currentSite?.id) {
        const siteId = cleanUUID(currentSite.id);
        if (siteId) {
          invalidateCache(siteId);
        }
      }
      
    } catch (error) {
      console.error("Error al actualizar la prioridad:", error)
      toast({
        title: "Error",
        variant: "destructive",
        description: error instanceof Error ? error.message : "Error al actualizar la prioridad",
      })
      throw error
    }
  }

  // Efecto para filtrar los requisitos según la pestaña activa y otros filtros
  useEffect(() => {
    if (!requirements || requirements.length === 0) {
      setFilteredRequirements([]);
      return;
    }

    // Obtener requisitos que coinciden con los criterios de búsqueda
    let filtered = [...requirements];

    // Filtrar por texto de búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(req => 
        req.title.toLowerCase().includes(query) || 
        req.description.toLowerCase().includes(query) ||
        req.source.toLowerCase().includes(query)
      );
    }

    // Aplicar filtros avanzados si están definidos
    if (filters.priority.length > 0) {
      filtered = filtered.filter(req => filters.priority.includes(req.priority));
    }

    if (filters.segments.length > 0) {
      filtered = filtered.filter(req => 
        req.segments.some(segId => filters.segments.includes(segId))
      );
    }

    if (filters.completionStatus.length > 0) {
      filtered = filtered.filter(req => 
        filters.completionStatus.includes(req.completionStatus)
      );
    }
    
    if (filters.status.length > 0) {
      filtered = filtered.filter(req => 
        filters.status.includes(req.status)
      );
    }

    // Filtrar según la pestaña activa
    if (activeTab !== "all") {
      switch (activeTab) {
        case "pending":
          filtered = filtered.filter(req => req.completionStatus === COMPLETION_STATUS.PENDING);
          break;
        case "completed":
          filtered = filtered.filter(req => req.completionStatus === COMPLETION_STATUS.COMPLETED);
          break;
        case "rejected":
          filtered = filtered.filter(req => req.completionStatus === COMPLETION_STATUS.REJECTED);
          break;
      }
    }

    setFilteredRequirements(filtered);
  }, [requirements, activeTab, searchQuery, filters]);

  // Security mechanism to prevent indefinite loading
  useEffect(() => {
    if (isLoading) {
      const timeoutId = setTimeout(() => {
        // If still loading after 10 seconds, force reset
        if (isLoading) {
          setIsLoading(false);
          
          // If no data, show an error
          if (requirements.length === 0) {
            setVisibleError("Loading time exceeded. Please try again.");
          }
        }
      }, 10000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, requirements.length]);

  // Componentes de estado
  const NoSiteSelected = () => (
    <div className="flex flex-col items-center justify-center p-8 text-center h-[300px]">
      <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-xl font-medium mb-2">No site selected</h3>
      <p className="text-muted-foreground max-w-md">
        Please create or select a site to manage its requirements.
      </p>
    </div>
  )

  const LoadingState = () => (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <Card key={i} className="overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row items-start gap-4">
              <div className="w-full lg:w-1/4">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
              <div className="flex flex-wrap gap-6 w-full lg:w-3/4">
                <div className="min-w-[120px]">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="min-w-[120px]">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="min-w-[120px]">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="min-w-[120px]">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
                <div className="min-w-[120px]">
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )

  const EmptyResults = () => {
    // Determinar el mensaje adecuado según el contexto
    const getTabName = (tab: string): string => {
      switch (tab) {
        case "validated": return "validated requirements";
        case "in-progress": return "in-progress requirements";
        case "backlog": return "backlog requirements";
        default: return "all requirements";
      }
    };
    const tabName = getTabName(activeTab);
    
    return (
      <EmptyState
        icon={<ClipboardList className="w-24 h-24 text-primary/40" />}
        title={searchQuery ? "No matching requirements found" : "No requirements found"}
        description={
          searchQuery 
            ? "No results for your search. Try with other terms."
            : requirements.length > 0 
              ? `There are ${requirements.length} requirements in the database, but none match the current filter (${tabName}).`
              : "No requirements created yet. Create a new one to start."
        }
      />
    );
  };

  // Función de búsqueda
  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  // Función para aplicar filtros avanzados
  const handleApplyFilters = (newFilters: RequirementFilters) => {
    setFilters(newFilters);
  };

  // Función para limpiar todos los filtros
  const handleClearFilters = () => {
    setFilters({
      priority: [],
      completionStatus: [],
      status: [],
      segments: []
    });
    setSearchQuery("");
    setActiveTab("all");
    
    // Resetear el campo de búsqueda
    if (searchInputRef.current) {
      searchInputRef.current.value = "";
    }
  };

  // Función para abrir el modal de filtros
  const handleOpenFilterModal = () => {
    setIsFilterModalOpen(true);
  };

  return (
    <div className="flex-1 p-0">
      {/* Loading indicator */}
      {isLoading && (
        <div className="fixed bottom-4 right-4 bg-blue-100 text-blue-800 p-4 rounded-md shadow-md z-50 animate-pulse">
          Loading requirements...
        </div>
      )}
      
      {/* Modal de filtros */}
      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        segments={segments}
        completionStatusOptions={[COMPLETION_STATUS.PENDING, COMPLETION_STATUS.COMPLETED, COMPLETION_STATUS.REJECTED]}
        statusOptions={[REQUIREMENT_STATUS.IN_PROGRESS, REQUIREMENT_STATUS.ON_REVIEW, REQUIREMENT_STATUS.DONE, REQUIREMENT_STATUS.BACKLOG, REQUIREMENT_STATUS.CANCELED]}
      />
      
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-8">
                <TabsList>
                  <TabsTrigger value="all">All Requirements</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                  <TabsTrigger value="rejected">Rejected</TabsTrigger>
                </TabsList>
                <SearchInput
                  placeholder="Search requirements..."
                  value={searchQuery}
                  onSearch={handleSearch}
                  ref={searchInputRef}
                  className="bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
                />
                <Button variant="outline" onClick={handleOpenFilterModal}>
                  <Filter className="mr-2 h-4 w-4" />
                  Filter
                </Button>
              </div>
              <div className="ml-auto">
                {/* Indicador de filtros activos */}
                {(filters.priority.length > 0 || filters.completionStatus.length > 0 || filters.segments.length > 0) && (
                  <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                    <Badge variant="outline" className="rounded-full px-2 py-0">
                      {filters.priority.length + filters.completionStatus.length + filters.segments.length}
                    </Badge>
                    <span className="ml-2">Clear filters</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            {/* Rendering for all tabs */}
            {["all", "pending", "completed", "rejected"].map((tab) => (
              <TabsContent key={tab} value={tab} className="space-y-4 min-h-[300px]">
                {/* Case 1: No site selected */}
                {!currentSite ? (
                  <NoSiteSelected />
                ) : 
                /* Case 2: Visible error */
                visibleError ? (
                  <div className="p-4 border border-red-300 bg-red-50 rounded-md text-red-800 mb-4">
                    <h3 className="font-semibold mb-2">Error loading requirements</h3>
                    <p>{visibleError}</p>
                    <button 
                      onClick={() => window.location.reload()} 
                      className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md"
                    >
                      Retry
                    </button>
                  </div>
                ) : 
                /* Case 3: Loading */
                isLoading ? (
                  <LoadingState />
                ) : 
                /* Case 4: No filtered requirements to show */
                filteredRequirements.length === 0 ? (
                  <EmptyResults />
                ) : 
                /* Case 5: Show requirements */
                (
                  <div className="space-y-2">
                    {filteredRequirements.map((requirement) => (
                      <RequirementCard 
                        key={requirement.id} 
                        requirement={requirement} 
                        onUpdateStatus={handleUpdateStatus}
                        onUpdateCompletionStatus={handleUpdateCompletionStatus}
                        onUpdatePriority={handleUpdatePriority}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </div>
        </div>
      </Tabs>
    </div>
  )
}

// Exportamos esto para usarlo en el topbar
export { createRequirement } from "./actions"

// Exportamos también el tipo Segment
export type { Segment } from "./types"

// Ya no exportamos el componente para usarlo en el topbar, lo importan directamente
// export { CreateRequirementDialog } 