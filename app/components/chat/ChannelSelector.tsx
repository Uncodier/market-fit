"use client"

import React, { memo } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import * as Icons from "@/app/components/ui/icons"
import { LoadingSkeleton } from "@/app/components/ui/loading-skeleton"
import { WhatsAppIcon, InstagramIcon, TelegramIcon, MessengerIcon, FacebookIcon, ThreadsIcon, LinkedInIcon, TwitterIcon, YouTubeIcon } from "@/app/components/ui/social-icons"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { useLocalization } from '@/app/context/LocalizationContext'

type Channel = 'web' | 'email' | 'whatsapp' | 'instagram' | 'messenger' | 'sms' | 'telegram' | 'voice' | 'website_chat' | string

interface ChannelSelectorProps {
  selectedChannel: Channel
  onChannelChange: (channel: Channel) => void
  availableChannels: Channel[]
  className?: string
  isUpdating?: boolean
}

const channelConfig: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = {
  web: {
    icon: Icons.Globe,
    label: "Web"
  },
  website_chat: {
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
  },
  instagram: {
    icon: ({ className }: { className?: string }) => <InstagramIcon size={16} className={className} />,
    label: "Instagram"
  },
  messenger: {
    icon: ({ className }: { className?: string }) => <MessengerIcon size={16} className={className} />,
    label: "Messenger"
  },
  facebook: {
    icon: ({ className }: { className?: string }) => <FacebookIcon size={16} className={className} />,
    label: "Facebook"
  },
  threads: {
    icon: ({ className }: { className?: string }) => <ThreadsIcon size={16} className={className} />,
    label: "Threads"
  },
  linkedin: {
    icon: ({ className }: { className?: string }) => <LinkedInIcon size={16} className={className} />,
    label: "LinkedIn"
  },
  x: {
    icon: ({ className }: { className?: string }) => <TwitterIcon size={16} className={className} />,
    label: "X"
  },
  youtube: {
    icon: ({ className }: { className?: string }) => <YouTubeIcon size={16} className={className} />,
    label: "YouTube"
  },
  sms: {
    icon: Icons.MessageSquare,
    label: "SMS"
  },
  telegram: {
    icon: ({ className }: { className?: string }) => <TelegramIcon size={16} className={className} />,
    label: "Telegram"
  },
  voice: {
    icon: Icons.Phone,
    label: "Voice"
  }
}

const getChannelConfig = (channel: string) => {
  if (channelConfig[channel]) {
    return channelConfig[channel];
  }
  return {
    icon: Icons.Globe,
    label: channel.charAt(0).toUpperCase() + channel.slice(1)
  };
}

export const ChannelSelector = memo(function ChannelSelector({
  selectedChannel,
  onChannelChange,
  availableChannels,
  className,
  isUpdating = false
}: ChannelSelectorProps) {
  const { t } = useLocalization()
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
              const label = ['web', 'website_chat', 'email', 'voice', 'call'].includes(channel)
                ? t(`chat.channel.${channel === 'website_chat' ? 'web' : channel === 'call' ? 'voice' : channel}`) : config.label
              const IconComponent = config.icon
              const isSelected = channel === selectedChannel

              return (
                <Tooltip key={channel}>
                  <TooltipTrigger asChild>
                    <TabsTrigger
                      value={channel}
                      aria-label={label}
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
                    {isUpdating ? t('chat.channel.updating') : t('chat.channel.sendVia', { channel: label })}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </TooltipProvider>
        </TabsList>
      </Tabs>
      
      {isUpdating && (
        <div className="absolute inset-0 bg-background/20 rounded-md pointer-events-none" />
      )}
    </div>
  )
})
