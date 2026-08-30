import React, { memo } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import * as Icons from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { WhatsAppIcon, InstagramIcon, TelegramIcon } from "@/app/components/ui/social-icons"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"

type Channel = 'web' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'sms' | 'telegram' | 'voice' | 'website_chat' | string

interface ChannelSelectorProps {
  selectedChannel: Channel
  onChannelChange: (channel: Channel) => void
  availableChannels: Channel[]
  className?: string
  isUpdating?: boolean
}

const channelConfig: Record<string, {
  icon: any;
  label: string;
  description: string;
}> = {
  web: {
    icon: Icons.Globe,
    label: "Web",
    description: "Send via web chat"
  },
  website_chat: {
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
  },
  instagram: {
    icon: ({ className }: { className?: string }) => <InstagramIcon size={16} className={className} />,
    label: "Instagram",
    description: "Send via Instagram"
  },
  messenger: {
    icon: Icons.MessageCircle,
    label: "Messenger",
    description: "Send via Messenger"
  },
  sms: {
    icon: Icons.MessageSquare,
    label: "SMS",
    description: "Send via SMS"
  },
  telegram: {
    icon: ({ className }: { className?: string }) => <TelegramIcon size={16} className={className} />,
    label: "Telegram",
    description: "Send via Telegram"
  },
  voice: {
    icon: Icons.Phone,
    label: "Voice",
    description: "Send via Voice"
  }
}

const getChannelConfig = (channel: string) => {
  if (channelConfig[channel]) {
    return channelConfig[channel];
  }
  // Safe fallback for unknown channels
  return {
    icon: Icons.Globe,
    label: channel.charAt(0).toUpperCase() + channel.slice(1),
    description: `Send via ${channel}`
  };
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
          "h-8 p-0.5 bg-secondary/50 rounded-full font-inter transition-opacity duration-200",
          isUpdating && "opacity-70"
        )}>
          <TooltipProvider delayDuration={300}>
            {availableChannels.map((channel) => {
              const config = getChannelConfig(channel)
              const IconComponent = config.icon
              const isSelected = channel === selectedChannel

              return (
                <Tooltip key={channel}>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value={channel}
                      disabled={isUpdating}
                      className={cn(
                        "h-7 w-7 px-0 flex items-center justify-center rounded-full font-inter transition-all duration-200 border-0 focus:outline-none focus:ring-0",
                        "[&>*]:flex [&>*]:items-center [&>*]:justify-center",
                        "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-border",
                        isSelected
                          ? "bg-background text-foreground shadow-md ring-1 ring-border"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                        isUpdating && "cursor-not-allowed"
                      )}
                    >
                      {isUpdating && isSelected ? (
                        <LoadingSkeleton size="sm" />
                      ) : (
                        <IconComponent className="h-4 w-4" />
                      )}
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={6}>
                    {isUpdating ? "Updating channel..." : config.description}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </TooltipProvider>
        </TabsList>
      </Tabs>
      
      {/* Optional loading overlay for additional visual feedback */}
      {isUpdating && (
        <div className="absolute inset-0 bg-background/20 rounded-md pointer-events-none" />
      )}
    </div>
  )
})
