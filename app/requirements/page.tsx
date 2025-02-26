"use client"

import { Button } from "@/app/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Badge } from "@/app/components/ui/badge"
import { Checkbox } from "@/app/components/ui/checkbox"
import { PlusCircle, Filter, Search, ChevronDown, ChevronUp, XCircle, Check } from "lucide-react"
import { Input } from "@/app/components/ui/input"
import React from "react"

interface Requirement {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  status: "validated" | "in-progress" | "backlog"
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
    source: "Customer Interview",
    createdAt: "2024-01-25",
    segments: ["Mobile", "Sync", "Offline"]
  },
]

function RequirementCard({ requirement }: { requirement: Requirement }) {
  const [isExpanded, setIsExpanded] = React.useState(false)

  return (
    <Card 
      key={requirement.id} 
      className={`cursor-pointer transition-all border border-border hover:border-foreground/20`}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardHeader className="p-6">
        <div className="flex items-center gap-4 w-full">
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base font-medium">{requirement.title}</CardTitle>
              <CardDescription className="line-clamp-2">{requirement.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <Badge
                variant="secondary"
                className={
                  requirement.priority === "high"
                    ? "bg-red-50 text-red-700 hover:bg-red-50 border-red-200"
                    : requirement.priority === "medium"
                    ? "bg-yellow-50 text-yellow-700 hover:bg-yellow-50 border-yellow-200"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200"
                }
              >
                {requirement.priority.charAt(0).toUpperCase() + requirement.priority.slice(1)}
              </Badge>
              <Badge
                variant="secondary"
                className={
                  requirement.status === "validated"
                    ? "bg-green-50 text-green-700 hover:bg-green-50 border-green-200"
                    : requirement.status === "in-progress"
                    ? "bg-purple-50 text-purple-700 hover:bg-purple-50 border-purple-200"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-50 border-gray-200"
                }
              >
                {requirement.status === "in-progress" 
                  ? "In Progress" 
                  : requirement.status.charAt(0).toUpperCase() + requirement.status.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="px-6 pb-6 pt-0">
          <div className="space-y-6 border-t border-border pt-6">
            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-6">
                <div className="grid gap-2">
                  <div className="font-medium text-sm">Source</div>
                  <div className="text-sm text-muted-foreground">{requirement.source}</div>
                </div>
                <div className="grid gap-2">
                  <div className="font-medium text-sm">Created Date</div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(requirement.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="grid gap-2">
                  <div className="font-medium text-sm">Segments</div>
                  <div className="flex flex-wrap gap-1.5">
                    {requirement.segments.map((segment) => (
                      <Badge
                        key={segment}
                        variant="secondary"
                        className="bg-blue-50 text-blue-700 hover:bg-blue-50 border-blue-200"
                      >
                        {segment}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-2">
                <div className="font-medium text-sm">Instructions</div>
                <div className="text-sm text-muted-foreground">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button 
                variant="default" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  // Aquí iría la lógica para marcar como completado
                }}
              >
                <Check className="h-4 w-4" />
                Mark as Done
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={(e) => {
                  e.stopPropagation()
                  // Aquí iría la lógica para rechazar el requerimiento
                }}
              >
                <XCircle className="h-4 w-4" />
                Reject Requirement
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function RequirementsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <Tabs defaultValue="all" className="space-y-4">
        <div className="flex justify-between">
          <TabsList>
            <TabsTrigger value="all">All Requirements</TabsTrigger>
            <TabsTrigger value="validated">Validated</TabsTrigger>
            <TabsTrigger value="in-progress">In Progress</TabsTrigger>
            <TabsTrigger value="backlog">Backlog</TabsTrigger>
          </TabsList>
          <div className="relative w-64 pr-0">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search requirements..." className="pl-8" />
            <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </div>
        </div>
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
      </Tabs>
    </div>
  )
} 