"use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Checkbox } from "@/app/components/ui/checkbox"
import { PlusCircle, Filter, Search, ChevronDown, ChevronUp, XCircle, Check, Archive, RotateCcw, CheckCircle2, Ban } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { Collapsible, CollapsibleContent } from "@/app/components/ui/collapsible"
import React from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"

interface Requirement {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  status: "validated" | "in-progress" | "backlog"
  completionStatus: "pending" | "completed" | "rejected"
  source: string
  createdAt: string
  segments: string[]
}

const requirements: Requirement[] = [
  {
    id: "1",
    title: "Multi-user collaboration",
    description: "Allow multiple users to work on the same document simultaneously",
    priority: "high",
    status: "validated",
    completionStatus: "completed",
    source: "Customer Interview",
    createdAt: "2023-12-10",
    segments: ["Enterprise", "Teams", "Collaboration"]
  },
  {
    id: "2",
    title: "Mobile app notifications",
    description: "Push notifications for important events and updates",
    priority: "medium",
    status: "validated",
    completionStatus: "pending",
    source: "Feature Request",
    createdAt: "2023-12-15",
    segments: ["Mobile", "Notifications"]
  },
  {
    id: "3",
    title: "Advanced analytics dashboard",
    description: "Provide deeper insights with customizable reports",
    priority: "high",
    status: "in-progress",
    completionStatus: "pending",
    source: "Customer Interview",
    createdAt: "2024-01-05",
    segments: ["Analytics", "Enterprise", "Reporting"]
  },
  {
    id: "4",
    title: "API integration with Zapier",
    description: "Allow users to connect with thousands of apps via Zapier",
    priority: "medium",
    status: "in-progress",
    completionStatus: "rejected",
    source: "Support Ticket",
    createdAt: "2024-01-12",
    segments: ["Integrations", "API", "Automation"]
  },
  {
    id: "5",
    title: "Dark mode support",
    description: "Add dark mode theme option for better night-time usage",
    priority: "low",
    status: "backlog",
    completionStatus: "pending",
    source: "Feature Request",
    createdAt: "2024-01-20",
    segments: ["UI/UX", "Accessibility"]
  },
  {
    id: "6",
    title: "Offline mode",
    description: "Allow users to work offline and sync when back online",
    priority: "medium",
    status: "backlog",
    completionStatus: "pending",
    source: "Customer Interview",
    createdAt: "2024-01-25",
    segments: ["Mobile", "Sync", "Offline"]
  },
]

function RequirementCard({ requirement }: { requirement: Requirement }) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  const priorityColors = {
    high: "bg-red-50 text-red-700 hover:bg-red-50 border-red-200",
    medium: "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200",
    low: "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200"
  }

  const statusColors = {
    validated: "bg-green-50 text-green-700 hover:bg-green-50 border-green-200",
    "in-progress": "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200",
    backlog: "bg-gray-50 text-gray-700 hover:bg-gray-50 border-gray-200"
  }

  const completionStatusColors = {
    completed: "bg-green-50 text-green-700 border-green-300",
    rejected: "bg-red-50 text-red-700 border-red-300",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-300"
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
                  <Badge variant="secondary" className={priorityColors[requirement.priority]}>
                    {requirement.priority.charAt(0).toUpperCase() + requirement.priority.slice(1)}
                  </Badge>
                </div>
                <div className="min-w-[120px] sm:min-w-[100px] p-2 rounded-lg">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Status</p>
                  <Badge variant="secondary" className={statusColors[requirement.status]}>
                    {requirement.status === "in-progress" 
                      ? "In Progress" 
                      : requirement.status.charAt(0).toUpperCase() + requirement.status.slice(1)}
                  </Badge>
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
                  <div className={`px-3 py-1 text-sm font-medium rounded-md border-2 text-center ${completionStatusColors[requirement.completionStatus]}`}>
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
                      {requirement.segments.map((segment) => (
                        <Badge
                          key={segment}
                          variant="secondary"
                          className="px-3 py-1 text-xs font-medium bg-gray-100/80 text-gray-700 hover:bg-gray-200/80 transition-colors border border-gray-200/50"
                        >
                          {segment}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  {requirement.completionStatus === "pending" && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto hover:bg-secondary/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Aquí iría la lógica para enviar al backlog
                        }}
                      >
                        <Archive className="h-4 w-4" />
                        Move to Backlog
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto hover:bg-secondary/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Aquí iría la lógica para marcar como completado
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Mark as Done
                      </Button>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Aquí iría la lógica para rechazar el requerimiento
                        }}
                      >
                        <Ban className="h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                  {requirement.completionStatus === "completed" && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto hover:bg-secondary/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Aquí iría la lógica para enviar al backlog
                        }}
                      >
                        <Archive className="h-4 w-4" />
                        Move to Backlog
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto hover:bg-secondary/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Aquí iría la lógica para revertir a pendiente
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Return to Pending
                      </Button>
                    </>
                  )}
                  {requirement.completionStatus === "rejected" && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto hover:bg-secondary/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Aquí iría la lógica para enviar al backlog
                        }}
                      >
                        <Archive className="h-4 w-4" />
                        Move to Backlog
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex items-center gap-2 w-full sm:w-auto hover:bg-secondary/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Aquí iría la lógica para revertir a pendiente
                        }}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Return to Pending
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

export default function RequirementsPage() {
  return (
    <div className="flex-1 p-0">
      <Tabs defaultValue="all">
        <StickyHeader>
          <div className="px-16 pt-0">
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <TabsList className="w-full">
                  <TabsTrigger value="all">All Requirements</TabsTrigger>
                  <TabsTrigger value="validated">Validated</TabsTrigger>
                  <TabsTrigger value="in-progress">In Progress</TabsTrigger>
                  <TabsTrigger value="backlog">Backlog</TabsTrigger>
                </TabsList>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search requirements..." className="pl-8 w-full" />
                <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </div>
            </div>
          </div>
        </StickyHeader>
        
        <div className="p-8 space-y-4">
          <div className="px-8">
            <TabsContent value="all" className="space-y-4">
              <div className="space-y-2">
                {requirements.map((requirement) => (
                  <RequirementCard key={requirement.id} requirement={requirement} />
                ))}
              </div>
            </TabsContent>
            <TabsContent value="validated" className="space-y-4">
              <div className="space-y-2">
                {requirements
                  .filter(r => r.status === "validated")
                  .map((requirement) => (
                    <RequirementCard key={requirement.id} requirement={requirement} />
                  ))}
              </div>
            </TabsContent>
            <TabsContent value="in-progress" className="space-y-4">
              <div className="space-y-2">
                {requirements
                  .filter(r => r.status === "in-progress")
                  .map((requirement) => (
                    <RequirementCard key={requirement.id} requirement={requirement} />
                  ))}
              </div>
            </TabsContent>
            <TabsContent value="backlog" className="space-y-4">
              <div className="space-y-2">
                {requirements
                  .filter(r => r.status === "backlog")
                  .map((requirement) => (
                    <RequirementCard key={requirement.id} requirement={requirement} />
                  ))}
              </div>
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  )
} 