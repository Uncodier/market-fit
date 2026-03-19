"use client"

import React, { memo } from "react"
import { cn } from "@/lib/utils"
import * as Icons from "@/app/components/ui/icons"
import { WhatsAppIcon } from "@/app/components/ui/social-icons"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"

type FilterType = 'all' | 'outbound' | 'inbound' | 'replied' | 'tasks' | 'assigned' | 'qualified'

interface ChannelFilterProps {
  selectedFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  className?: string
  userAvatarUrl?: string | null
  userName?: string
}

const getFilterConfig = (userAvatarUrl?: string | null, userName?: string) => ({
  all: {
    icon: ({ className }: { className?: string }) => <Icons.Clock className={cn("h-4 w-4", className)} />,
    label: "All"
  },
  outbound: {
    icon: ({ className }: { className?: string }) => <Icons.ArrowUp className={cn("h-4 w-4", className)} />,
    label: "Outbound"
  },
  inbound: {
    icon: ({ className }: { className?: string }) => <Icons.ArrowDown className={cn("h-4 w-4", className)} />,
    label: "Inbound"
  },
  replied: {
    icon: ({ className }: { className?: string }) => <Icons.Reply className={cn("h-4 w-4", className)} />,
    label: "Replied"
  },
  tasks: {
    icon: ({ className }: { className?: string }) => <Icons.ListTodo className={cn("h-4 w-4", className)} />,
    label: "Tasks"
  },
  assigned: {
    icon: ({ className }: { className?: string }) => (
      <Avatar className={cn("h-5 w-5 min-h-[20px] min-w-[20px]", className)}>
        <AvatarImage src={userAvatarUrl || undefined} alt={userName || "You"} />
        <AvatarFallback className="text-[9px] bg-primary/10 font-medium">
          {userName ? userName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : "U"}
        </AvatarFallback>
      </Avatar>
    ),
    label: "Assigned"
  },
  qualified: {
    icon: ({ className }: { className?: string }) => <Icons.CheckCircle2 className={cn("h-4 w-4", className)} />,
    label: "Qualified+"
  }
})

export const ChannelFilter = memo(function ChannelFilter({
  selectedFilter,
  onFilterChange,
  className,
  userAvatarUrl,
  userName
}: ChannelFilterProps) {
  const filterConfig = getFilterConfig(userAvatarUrl, userName)
  
  return (
    <div 
      className={cn(
    "px-4 py-3 border-b dark:border-white/5 border-black/5 flex justify-center flex-shrink-0 h-[56px] max-h-[56px] min-h-[56px] overflow-hidden",
    "sticky top-0 z-[20]",
    "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
      style={{ WebkitBackdropFilter: 'blur(10px)' }}
    >
      <Tabs 
        value={selectedFilter} 
        onValueChange={(value) => onFilterChange(value as FilterType)}
        className="w-auto flex items-center"
      >
        <TabsList className="h-8 max-h-8 min-h-[32px] p-0.5 bg-muted/30 grid-cols-7 rounded-full font-inter flex-shrink-0">
          <TooltipProvider delayDuration={300}>
            {(Object.keys(filterConfig) as FilterType[]).map((filter) => {
              const config = filterConfig[filter]
              const IconComponent = config.icon

              return (
                <Tooltip key={filter}>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value={filter}
                      className={cn(
                        "h-7 w-7 px-0 flex items-center justify-center rounded-full font-inter transition-all duration-200 border-0 focus:outline-none focus:ring-0",
                        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-border",
                        filter === selectedFilter
                          ? "bg-background text-foreground shadow-md ring-1 ring-border"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <IconComponent />
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {config.label}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </TooltipProvider>
        </TabsList>
      </Tabs>
    </div>
  )
}) 