"use client"

import { Globe, Mail, Phone, Tag } from "@/app/components/ui/icons"
import { TooltipProvider } from "@/app/components/ui/tooltip"
import { ImprentaOptionToggle } from "./imprenta-option-toggle"

const audienceChannelOptions = [
  { key: "email", label: "Email", icon: Mail, hint: "Only include leads that have an email address." },
  { key: "web", label: "Web", icon: Globe, hint: "Only include leads that have a website URL." },
  { key: "phone", label: "Phone", icon: Phone, hint: "Only include leads that have a phone number." },
  { key: "deals", label: "Deals", icon: Tag, hint: "Only include leads that have at least one deal." },
] as const

type ImprentaAudienceChannelSelectorProps = {
  channels?: string[] | null
  onChannelsChange: (channels: string[]) => void | Promise<void>
}

export function ImprentaAudienceChannelSelector({
  channels,
  onChannelsChange,
}: ImprentaAudienceChannelSelectorProps) {
  const currentChannels = Array.isArray(channels) ? channels : []

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid w-full grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 [&>*]:min-w-0">
        {audienceChannelOptions.map(({ key, label, icon: Icon, hint }) => {
          const selected = currentChannels.includes(key)

          return (
            <ImprentaOptionToggle
              key={key}
              label={label}
              icon={<Icon size={12} />}
              hint={hint}
              selected={selected}
              onToggle={() => onChannelsChange(
                selected
                  ? currentChannels.filter((channel) => channel !== key)
                  : [...currentChannels, key]
              )}
            />
          )
        })}
      </div>
    </TooltipProvider>
  )
}