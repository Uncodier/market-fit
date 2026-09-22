"use client"

import type { ReactNode } from "react"

import { isSocialMediaEntryConnected } from "@/app/components/settings/data-adapter"
import { Bot, FileText, Globe, Mail, Phone, Play } from "@/app/components/ui/icons"
import { SocialIcon } from "@/app/components/ui/social-icons"
import { Switch } from "@/app/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"
import {
  getPublishChannelAvailability,
  togglePublishDestination,
} from "@/app/components/agents/imprenta-publish-routing"
import type { SiteChannelSource } from "@/lib/site-channels"

type PublishDestinationSite = SiteChannelSource & {
  url?: string | null
}

type ImprentaPublishDestinationSelectorProps = {
  site?: PublishDestinationSite | null
  destinations?: string[] | null
  onDestinationsChange: (destinations: string[]) => void | Promise<void>
}

export function ImprentaPublishDestinationSelector({
  site,
  destinations,
  onDestinationsChange,
}: ImprentaPublishDestinationSelectorProps) {
  const siteUrl = site?.url && String(site.url).trim()
  const currentDestinations = Array.isArray(destinations)
    ? destinations
    : siteUrl
      ? ["blog"]
      : []
  const channelAvailability = getPublishChannelAvailability(site)

  const renderToggle = (
    key: string,
    label: string,
    icon: ReactNode,
    hint: string
  ) => {
    const isSelected = currentDestinations.includes(key)

    return (
      <Tooltip key={key}>
        <TooltipTrigger asChild>
          <label
            className="flex w-full min-w-0 cursor-pointer select-none items-center gap-1.5 text-[11px]"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="flex h-[12px] w-[12px] shrink-0 items-center justify-center text-muted-foreground [&>div]:h-full [&>div]:w-full [&>span]:h-full [&>span]:w-full [&>svg]:h-full [&>svg]:w-full">
              {icon}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-right font-medium ${
                isSelected ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            <Switch
              aria-label={label}
              checked={isSelected}
              onCheckedChange={() =>
                onDestinationsChange(
                  togglePublishDestination(currentDestinations, key)
                )
              }
              onClick={(event) => event.stopPropagation()}
            />
          </label>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-[11px]">
          {hint}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid w-full grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 [&>*]:min-w-0">
        {(site?.settings?.social_media || [])
          .filter(isSocialMediaEntryConnected)
          .map((socialAccount) => {
            const platform = String(socialAccount.platform)
            const platformLabel =
              platform.charAt(0).toUpperCase() + platform.slice(1)

            return renderToggle(
              platform,
              platformLabel,
              <SocialIcon platform={platform} size={12} color="currentColor" />,
              `Publish this content to your connected ${platformLabel} account.`
            )
          })}
        {siteUrl &&
          renderToggle(
            "blog",
            "Blog",
            <Globe size={12} />,
            "Publish this content as a blog post on your site."
          )}
        {channelAvailability.email &&
          renderToggle(
            "mail",
            "Mail",
            <Mail size={12} />,
            "Send this content as an individual email to the selected audience."
          )}
        {channelAvailability.email &&
          renderToggle(
            "newsletter",
            "Newsletter",
            <FileText
              size={12}
              className="[&>svg]:block [&>svg]:-translate-x-px"
            />,
            "Include this content in your next newsletter to subscribers."
          )}
        {channelAvailability.whatsapp &&
          renderToggle(
            "whatsapp",
            "WhatsApp",
            <SocialIcon platform="whatsapp" size={12} color="currentColor" />,
            "Send this content through your connected WhatsApp channel."
          )}
        {channelAvailability.telegram &&
          renderToggle(
            "telegram",
            "Telegram",
            <SocialIcon platform="telegram" size={12} color="currentColor" />,
            "Send this content through your connected Telegram channel."
          )}
        {channelAvailability.sms &&
          renderToggle(
            "sms",
            "SMS",
            <Phone size={12} />,
            "Send this content as an SMS message."
          )}
        {channelAvailability.voice &&
          renderToggle(
            "voice",
            "Voice Message",
            <Play size={12} />,
            "Send this content as a one-way text-to-speech voice message."
          )}
        {channelAvailability.voice &&
          renderToggle(
            "voice-agent-call",
            "Voice Agent Call",
            <Bot size={12} />,
            "Start a conversational outbound voice agent call."
          )}
      </div>
    </TooltipProvider>
  )
}
