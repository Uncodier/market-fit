"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Badge } from "@/app/components/ui/badge"
import { Clock, ChevronDown, ChevronUp, ClipboardList, ExternalLink } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { FinancialStats } from "./financial-stats"
import { useRouter } from "next/navigation"
import { navigateToRequirement, navigateToCampaign } from "@/app/hooks/use-navigation-history"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table"
import React from "react"

interface SubTask {
  id: string
  title: string
  status: "completed" | "in-progress" | "pending"
}

interface Requirement {
  id: string
  title: string
  description?: string
  status: "validated" | "in-progress" | "on-review" | "done" | "backlog" | "canceled" | string
  priority: "high" | "medium" | "low"
  completion_status: "completed" | "pending" | "rejected" | string
}

interface KanbanCardProps {
  id: string
  title: string
  description: string
  priority: "high" | "medium" | "low"
  status?: string
  dueDate?: string
  assignees?: number
  issues?: number
  subtasks?: SubTask[]
  requirements?: Requirement[]
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
  metadata?: {
    payment_status?: {
      status: 'pending' | 'paid' | 'failed'
      amount_paid?: number
      amount_due?: number
      currency?: string
      payment_method?: string
      stripe_payment_intent_id?: string
      payment_date?: string
      invoice_number?: string
      outsourced?: boolean
      outsource_provider?: string
      outsource_contact?: string
    }
  }
  onCardClick?: (id: string, title: string) => void
}

export function KanbanCard({ 
  id,
  title, 
  description, 
  priority, 
  status,
  dueDate, 
  assignees, 
  issues,
  subtasks = [],
  requirements = [],
  revenue,
  budget,
  costs,
  metadata,
  onCardClick
}: KanbanCardProps) {
  const [expanded, setExpanded] = useState(false)
  const router = useRouter()
  
  const priorityColor = {
    high: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
    low: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
  }

  const statusConfig: Record<string, { dot: string; text: string }> = {
    // Campaign status colors - dot and text
    "active": { 
      dot: "bg-emerald-500 dark:bg-emerald-400", 
      text: "text-emerald-700 dark:text-emerald-300" 
    },
    "draft": { 
      dot: "bg-amber-500 dark:bg-amber-400", 
      text: "text-amber-700 dark:text-amber-300" 
    },
    "pending": { 
      dot: "bg-orange-500 dark:bg-orange-400", 
      text: "text-orange-700 dark:text-orange-300" 
    },
    "completed": { 
      dot: "bg-green-500 dark:bg-green-400", 
      text: "text-green-700 dark:text-green-300" 
    },
    // Legacy status colors
    "in-progress": { 
      dot: "bg-blue-500 dark:bg-blue-400", 
      text: "text-blue-700 dark:text-blue-300" 
    },
    "validated": { 
      dot: "bg-green-500 dark:bg-green-400", 
      text: "text-green-700 dark:text-green-300" 
    },
    "on-review": { 
      dot: "bg-purple-500 dark:bg-purple-400", 
      text: "text-purple-700 dark:text-purple-300" 
    },
    "done": { 
      dot: "bg-green-500 dark:bg-green-400", 
      text: "text-green-700 dark:text-green-300" 
    },
    "backlog": { 
      dot: "bg-slate-500 dark:bg-slate-400", 
      text: "text-slate-700 dark:text-slate-300" 
    },
    "canceled": { 
      dot: "bg-red-500 dark:bg-red-400", 
      text: "text-red-700 dark:text-red-300" 
    }
  }

  const completionStatusColor: Record<string, string> = {
    "completed": "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    "pending": "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    "rejected": "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
  }

  const hasRequirements = requirements.length > 0
  const pendingRequirements = requirements.filter(req => req.completion_status === "pending")
  const hasPendingRequirements = pendingRequirements.length > 0
  const hasFinancialData = (
    revenue || budget || costs
  )
  
  // Check if campaign is outsourced
  const isOutsourced = metadata?.payment_status?.outsourced || false
  const outsourcingStatus = metadata?.payment_status?.status || 'pending'
  const outsourceProvider = metadata?.payment_status?.outsource_provider || 'External Provider'
  
  // Debug: Log requirements to see if descriptions are present
  React.useEffect(() => {
    if (hasRequirements && expanded) {
      console.log("Campaign:", id, title);
      console.log("Requirements details:", requirements);
      console.log("Requirements fields:", requirements.map(req => Object.keys(req)));
    }
  }, [expanded, requirements, id, title, hasRequirements]);

  const handleCardClick = (e: React.MouseEvent) => {
    // Use the onCardClick prop if provided, otherwise use router navigation
    if (onCardClick) {
      onCardClick(id, title);
    } else {
      navigateToCampaign({
        campaignId: id,
        campaignName: title,
        router
      })
    }
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event from navigating
    setExpanded(!expanded);
  };

  const handleRequirementClick = (e: React.MouseEvent, requirementId: string, requirementTitle: string) => {
    e.stopPropagation(); // Prevent card click event from navigating
    navigateToRequirement({
      requirementId,
      requirementTitle,
      router
    })
  };

  // Calculate derived costs from budget if they're not provided
  const calculatedCosts = costs || {
    fixed: budget?.allocated && budget?.remaining 
      ? Math.round((budget.allocated - budget.remaining) * 0.6) // Just an estimate, 60% fixed costs
      : 0,
    variable: budget?.allocated && budget?.remaining
      ? Math.round((budget.allocated - budget.remaining) * 0.4) // 40% variable costs
      : 0,
    total: budget?.allocated && budget?.remaining
      ? budget.allocated - budget.remaining
      : 0,
    currency: budget?.currency || "USD"
  };

  return (
    <Card className="shadow-sm cursor-pointer transition-all hover:shadow-md hover:translate-y-[-2px] h-auto flex flex-col mb-1"
      onClick={handleCardClick}
    >
      <CardHeader className="p-5 pb-2">
        <CardTitle className="text-sm flex justify-between items-start gap-3">
          <span className="font-medium">{title}</span>
          <Badge className={priorityColor[priority]}>
            {priority}
          </Badge>
        </CardTitle>
        {(dueDate || status || metadata?.payment_status) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {dueDate && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{dueDate}</span>
              </div>
            )}
            {status && (
              <div className="flex items-center gap-1.5">
                <div 
                  className={cn(
                    "w-2 h-2 rounded-full",
                    statusConfig[status]?.dot || "bg-slate-500 dark:bg-slate-400"
                  )}
                />
                <span 
                  className={cn(
                    "text-xs font-medium capitalize",
                    statusConfig[status]?.text || "text-slate-700 dark:text-slate-300"
                  )}
                >
                  {status}
                </span>
              </div>
            )}
            {metadata?.payment_status && (
              <div className="flex items-center gap-1.5">
                <div 
                  className={cn(
                    "w-2 h-2 rounded-full",
                    metadata.payment_status.status === 'paid'
                      ? "bg-green-500 dark:bg-green-400"
                      : metadata.payment_status.status === 'failed'
                      ? "bg-red-500 dark:bg-red-400"
                      : "bg-yellow-500 dark:bg-yellow-400"
                  )}
                />
                <span 
                  className={cn(
                    "text-xs font-medium capitalize",
                    metadata.payment_status.status === 'paid'
                      ? "text-green-700 dark:text-green-300"
                      : metadata.payment_status.status === 'failed'
                      ? "text-red-700 dark:text-red-300"
                      : "text-yellow-700 dark:text-yellow-300"
                  )}
                >
                  {metadata.payment_status.outsourced && metadata.payment_status.status === 'paid' 
                    ? `Paid - ${metadata.payment_status.outsource_provider || 'Outsourced'}`
                    : metadata.payment_status.status === 'paid' ? 'Paid' : 
                      metadata.payment_status.status === 'failed' ? 'Payment Failed' : 'Payment Pending'}
                </span>
              </div>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-5 pt-2 space-y-3 flex-1 flex flex-col">
        <p className="text-xs text-muted-foreground">{description}</p>
        
        <div 
          className="flex items-center justify-between bg-muted/30 p-2.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
          onClick={handleToggleExpand}
          role="button"
          aria-expanded={expanded}
          title={expanded ? "Click to hide details" : "Click to show details"}
        >
          <div className="flex gap-3">
            {isOutsourced ? (
              <div className="flex items-center">
                <ExternalLink className="h-3.5 w-3.5 text-blue-600 mr-1.5" />
                <span className="text-xs font-medium text-blue-600 mr-1">Outsourced</span>
                <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                  {outsourcingStatus === 'paid' ? 'Paid' : outsourcingStatus}
                </span>
              </div>
            ) : hasRequirements && (
              <div className="flex items-center">
                <ClipboardList className="h-3.5 w-3.5 text-primary mr-1.5" />
                <span className="text-xs font-medium text-primary mr-1">{pendingRequirements.length}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[60px]">pending</span>
              </div>
            )}
          </div>
          
          {(isOutsourced || hasRequirements || hasFinancialData) && (
            <div className="flex items-center text-muted-foreground">
              {expanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          )}
        </div>
        
        {expanded && (
          <div className="space-y-4 mt-2">
            {/* Financial stats - Only shown in expanded view */}
            {hasFinancialData && (
              <div className="pt-2 w-full">
                <FinancialStats
                  revenue={revenue || { actual: 0, projected: 0, estimated: 0, currency: "USD" }}
                  budget={budget || { allocated: 0, remaining: 0, currency: "USD" }}
                  costs={calculatedCosts}
                  className="text-xs"
                />
              </div>
            )}
            
            {/* Requirements section - Only shown in expanded view */}
            {hasPendingRequirements && (
              <div className="pt-2 border-t w-full">
                <h4 className="text-xs font-medium mb-2">Pending Requirements ({pendingRequirements.length})</h4>
                <div className="w-full text-xs overflow-visible">
                  <div className="w-full border rounded-md overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted/30 h-8">
                        <tr>
                          <th className="h-7 text-xs font-medium w-full text-left px-2">Title</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingRequirements.map((req, index) => (
                          <tr 
                            key={req.id}
                            className={cn(
                              "hover:bg-muted/20 cursor-pointer",
                              index > 0 ? "border-t" : ""
                            )}
                            onClick={(e) => handleRequirementClick(e, req.id, req.title)}
                          >
                            <td className="py-1.5 px-3 align-middle">
                              <div className="truncate font-medium">{req.title}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 