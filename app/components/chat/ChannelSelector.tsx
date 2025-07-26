import React, { memo } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import * as Icons from "@/app/components/ui/icons"
import { WhatsAppIcon } from "@/app/components/ui/social-icons"
import { cn } from "@/lib/utils"

type Channel = 'web' | 'email' | 'whatsapp'

interface ChannelSelectorProps {
  selectedChannel: Channel
  onChannelChange: (channel: Channel) => void
  availableChannels: Channel[]
  className?: string
  isUpdating?: boolean
}

const channelConfig = {
  web: {
    icon: Icons.Globe,
    label: "Web",
    description: "Send via web chat"
  },
  email: {
    icon: Icons.Mail,
    label: "Email",
    description: "Send via email"
  },
  whatsapp: {
    icon: ({ className }: { className?: string }) => <WhatsAppIcon size={16} className={className} />,
    label: "WhatsApp",
    description: "Send via WhatsApp"
  }
}

export const ChannelSelector = memo(function ChannelSelector({
  selectedChannel,
  onChannelChange,
  availableChannels,
  className,
  isUpdating = false
}: ChannelSelectorProps) {
  // Don't render if there's only one available channel or none
  if (availableChannels.length <= 1) {
    return null
  }

  return (
    <div className={cn("relative", className)}>
      <Tabs 
        value={selectedChannel} 
        onValueChange={(value) => onChannelChange(value as Channel)}
        className="w-auto"
      >
        <TabsList className={cn(
          "h-8 p-0.5 transition-opacity duration-200",
          isUpdating && "opacity-70"
        )}>
          {availableChannels.map((channel) => {
            const config = channelConfig[channel]
            const IconComponent = config.icon

            return (
              <TabsTrigger
                key={channel}
                value={channel}
                disabled={isUpdating}
                className={cn(
                  "h-7 w-7 px-0 flex items-center justify-center rounded-sm transition-all duration-200",
                  isUpdating && "cursor-not-allowed"
                )}
                title={isUpdating ? "Updating channel..." : config.description}
              >
                {isUpdating && channel === selectedChannel ? (
                  <Icons.Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <IconComponent className="h-4 w-4" />
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
      
      {/* Optional loading overlay for additional visual feedback */}
      {isUpdating && (
        <div className="absolute inset-0 bg-background/20 rounded-md pointer-events-none" />
      )}
    </div>
  )
}) 