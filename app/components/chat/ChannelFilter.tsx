"use client"

import React, { memo } from "react"
import { cn } from "@/lib/utils"
import * as Icons from "@/app/components/ui/icons"
import { WhatsAppIcon } from "@/app/components/ui/social-icons"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar"

type FilterType = 'all' | 'web' | 'email' | 'whatsapp' | 'assigned' | 'ai'

interface ChannelFilterProps {
  selectedFilter: FilterType
  onFilterChange: (filter: FilterType) => void
  className?: string
  userAvatarUrl?: string | null
  userName?: string
}

const getFilterConfig = (userAvatarUrl?: string | null, userName?: string) => ({
  all: {
    icon: Icons.MoreHorizontal,
    label: "All"
  },
  web: {
    icon: ({ className }: { className?: string }) => <Icons.Globe className="h-2.5 w-2.5 text-current" />,
    label: "Web"
  },
  email: {
    icon: ({ className }: { className?: string }) => <Icons.Mail className="h-2.5 w-2.5 text-current" />,
    label: "Email"
  },
  whatsapp: {
    icon: ({ className }: { className?: string }) => <WhatsAppIcon size={16} className={className} />,
    label: "WhatsApp"
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
    label: "Assigned to me"
  },
  ai: {
    icon: ({ className }: { className?: string }) => <Icons.Sparkles className="h-4 w-4 text-current" />,
    label: "AI Team"
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
    <div className={cn("px-4 py-3 border-b border-border/30 flex justify-center", className)}>
      <Tabs 
        value={selectedFilter} 
        onValueChange={(value) => onFilterChange(value as FilterType)}
        className="w-auto"
      >
        <TabsList className="h-8 p-0.5 bg-muted/30 grid-cols-6">
          {(Object.keys(filterConfig) as FilterType[]).map((filter) => {
            const config = filterConfig[filter]
            const IconComponent = config.icon

            return (
              <TabsTrigger
                key={filter}
                value={filter}
                className="h-7 w-7 px-0 flex items-center justify-center rounded-sm transition-all duration-200"
                title={config.label}
              >
                <IconComponent className={filter === 'web' || filter === 'email' || filter === 'assigned' || filter === 'ai' ? "" : "h-3.5 w-3.5 text-current"} />
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
    </div>
  )
}) 