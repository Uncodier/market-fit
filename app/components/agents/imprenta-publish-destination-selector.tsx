"use client"

import type { ReactNode } from "react"

import { Bot, Check, FileText, Globe, Mail, Phone, Play } from "@/app/components/ui/icons"
import { SocialIcon } from "@/app/components/ui/social-icons"
import { Button } from "@/app/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/components/ui/tooltip"
import {
  togglePublishDestination,
} from "@/app/components/agents/imprenta-publish-routing"
import type { SiteChannelSource } from "@/lib/site-channels"
import { getPublishOptions, resolveLegacyPublishSelections } from "./imprenta-publish-options"
import { publishDestinationMode } from "@/lib/content/publish-destinations"

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
  const options = getPublishOptions(site)
  const savedDestinations = Array.isArray(destinations)
    ? destinations
    : siteUrl
      ? ["blog"]
      : []
  const currentDestinations = resolveLegacyPublishSelections(savedDestinations, options)
  const ambiguous = savedDestinations.filter((value) => !value.includes(":") && options.filter((option) => option.mode === publishDestinationMode(value)).length > 1)
  const missing = savedDestinations.filter((value) => value.includes(":") && !options.some((option) => option.key === value))
  const iconFor = (mode: string) => {
    if (mode === "mail") return <Mail size={12} />
    if (mode === "newsletter") return <FileText size={12} />
    if (mode === "sms") return <Phone size={12} />
    if (mode === "voice") return <Play size={12} />
    if (mode === "voice-agent-call") return <Bot size={12} />
    return <SocialIcon platform={mode} size={12} color="currentColor" />
  }

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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-label={label}
            aria-pressed={isSelected}
            data-state={isSelected ? "on" : "off"}
            className={`h-8 w-full min-w-0 justify-start gap-2 rounded-md px-2.5 text-left text-[11px] ${
              isSelected
                ? "bg-secondary text-foreground ring-1 ring-inset ring-foreground/20"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
            }`}
            onClick={(event) => {
              event.stopPropagation()
              onDestinationsChange(
                togglePublishDestination(currentDestinations.filter((value) =>
                  !ambiguous.includes(value) || publishDestinationMode(value) !== publishDestinationMode(key)), key)
              )
            }}
          >
            <span aria-hidden="true" className="flex h-3 w-3 shrink-0 items-center justify-center [&>div]:h-full [&>div]:w-full [&>span]:h-full [&>span]:w-full [&>svg]:h-full [&>svg]:w-full">
              {icon}
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            <span aria-hidden="true" className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
              {isSelected && <Check size={14} />}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-[11px]">
          {hint}
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid w-full grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 [&>*]:min-w-0">
        {options.map((option) => renderToggle(option.key, option.label, iconFor(option.mode), option.hint))}
        {siteUrl &&
          renderToggle(
            "blog",
            "Blog",
            <Globe size={12} />,
            "Publish this content as a blog post on your site."
          )}
      </div>
      {ambiguous.length > 0 && <p role="alert" className="text-[11px] text-destructive">Choose specific accounts for: {ambiguous.join(", ")}. The previous channel selection is ambiguous.</p>}
      {missing.length > 0 && <div className="space-y-1">
        <p role="alert" className="text-[11px] text-destructive">A selected account is no longer connected. Remove it or reconnect it before publishing.</p>
        {missing.map((value) => renderToggle(value, "Unavailable account", null, "Turn off this unavailable destination."))}
      </div>}
    </TooltipProvider>
  )
}
