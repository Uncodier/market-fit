"use client"

import { useState } from "react"
import { KanbanCard } from "./kanban-card"
import { ChevronDown, ChevronRight } from "@/app/components/ui/icons"
import "./kanban.css"
import { cn } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { navigateToCampaign } from "@/app/hooks/use-navigation-history"

interface KanbanColumnProps {
  title: string
  tasks: {
    id: string
    title: string
    description: string
    priority: "high" | "medium" | "low"
    status?: string
    dueDate?: string
    assignees?: number
    issues?: number
    revenue?: {
      actual?: number
      projected?: number
      estimated?: number
      currency?: string
    }
    budget?: {
      allocated?: number
      remaining?: number
      currency?: string
    }
    costs?: {
      fixed?: number
      variable?: number
      total?: number
      currency?: string
    }
    subtasks?: {
      id: string
      title: string
      status: "completed" | "in-progress" | "pending"
    }[]
    requirements?: {
      id: string
      title: string
      status: string
      priority: "high" | "medium" | "low"
      completion_status: string
    }[]
  }[]
  searchQuery?: string
}

export function KanbanColumn({ title, tasks, searchQuery = "" }: KanbanColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const router = useRouter()

  const filteredTasks = tasks.filter(task => {
    if (!searchQuery) return true
    
    const lowerCaseQuery = searchQuery.toLowerCase()
    return (
      task.title.toLowerCase().includes(lowerCaseQuery) ||
      task.description.toLowerCase().includes(lowerCaseQuery) ||
      task.requirements?.some(req => 
        req.title.toLowerCase().includes(lowerCaseQuery)
      )
    )
  })

  // Calculate total requirements count
  const requirementsCount = filteredTasks.reduce((total, task) => 
    total + (task.requirements?.length || 0), 0
  )

  const handleCardClick = (id: string, title: string) => {
    navigateToCampaign({
      campaignId: id,
      campaignName: title,
      router
    })
  }

  return (
    <div 
      className={cn(
        "flex flex-col transition-all duration-300 ease-in-out h-fit",
        isCollapsed ? "w-12" : "w-[320px]"
      )}
    >
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/70 rounded-md transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center w-full">
            <ChevronRight className="h-4 w-4 text-muted-foreground mb-1.5" />
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full mb-2">
              {filteredTasks.length}
            </span>
            <div className="writing-mode-vertical text-xs text-muted-foreground">
              {title.split("").join(" ")}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{title}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-full whitespace-nowrap max-w-[90px] overflow-hidden text-ellipsis">
                {filteredTasks.length} {filteredTasks.length === 1 ? 'camp.' : 'camp.'}
              </div>
              <div className="text-xs text-muted-foreground bg-primary/10 px-2 py-1 rounded-full whitespace-nowrap max-w-[90px] overflow-hidden text-ellipsis">
                {requirementsCount} {requirementsCount === 1 ? 'req.' : 'req.'}
              </div>
            </div>
          </>
        )}
      </div>
      {!isCollapsed && (
        <div className="flex flex-col gap-5 p-2 pb-5 bg-muted/10 dark:bg-transparent rounded-md mt-2 h-fit">
          {filteredTasks.map((task) => (
            <KanbanCard
              key={task.id}
              {...task}
              onCardClick={handleCardClick}
            />
          ))}
          {filteredTasks.length === 0 && (
            <div className="text-xs text-muted-foreground p-4 text-center bg-muted/20 rounded-md">
              No campaigns match your search
            </div>
          )}
        </div>
      )}
    </div>
  )
} 