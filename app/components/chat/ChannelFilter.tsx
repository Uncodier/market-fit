"use client"

import React, { memo } from "react"
import { cn } from "@/lib/utils"
import * as Icons from "@/app/components/ui/icons"
import { WhatsAppIcon } from "@/app/components/ui/social-icons"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"

type FilterChannel = 'all' | 'web' | 'email' | 'whatsapp'

interface ChannelFilterProps {
  selectedFilter: FilterChannel
  onFilterChange: (filter: FilterChannel) => void
  className?: string
}

const filterConfig = {
  all: {
    icon: Icons.MoreHorizontal,
    label: "All"
  },
  web: {
    icon: Icons.Globe,
    label: "Web"
  },
  email: {
    icon: Icons.Mail,
    label: "Email"
  },
  whatsapp: {
    icon: ({ className }: { className?: string }) => <WhatsAppIcon size={16} className={className} />,
    label: "WhatsApp"
  }
}

export const ChannelFilter = memo(function ChannelFilter({
  selectedFilter,
  onFilterChange,
  className
}: ChannelFilterProps) {
  return (
    <div className={cn("px-4 py-3 border-b border-border/30 flex justify-center", className)}>
      <Tabs 
        value={selectedFilter} 
        onValueChange={(value) => onFilterChange(value as FilterChannel)}
        className="w-auto"
      >
        <TabsList className="h-8 p-0.5 bg-muted/30">
          {(Object.keys(filterConfig) as FilterChannel[]).map((filter) => {
            const config = filterConfig[filter]
            const IconComponent = config.icon

            return (
              <TabsTrigger
                key={filter}
                value={filter}
                className="h-7 w-7 px-0 flex items-center justify-center rounded-sm transition-all duration-200"
                title={config.label}
              >
                <IconComponent className="h-3.5 w-3.5 text-current" />
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
    </div>
  )
}) 