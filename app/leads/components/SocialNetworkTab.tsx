"use client"

import { Input } from "@/app/components/ui/input"
import {
  Facebook,
  Twitter,
  Linkedin,
  Instagram,
  TikTok,
  YouTube,
  WhatsApp,
  Pinterest,
} from "./custom-icons"
import { Lead } from "@/app/leads/types"
import { PropertyRow, ShowEmptyFieldsToggle, hasPropertyValue } from "./PropertyRow"

const NETWORKS = [
  { key: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "LinkedIn profile URL" },
  { key: "twitter", label: "Twitter", icon: Twitter, placeholder: "Twitter profile URL" },
  { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "Facebook profile URL" },
  { key: "instagram", label: "Instagram", icon: Instagram, placeholder: "Instagram profile URL" },
  { key: "tiktok", label: "TikTok", icon: TikTok, placeholder: "TikTok profile URL" },
  { key: "youtube", label: "YouTube", icon: YouTube, placeholder: "YouTube channel URL" },
  { key: "whatsapp", label: "WhatsApp", icon: WhatsApp, placeholder: "WhatsApp number with country code" },
  { key: "pinterest", label: "Pinterest", icon: Pinterest, placeholder: "Pinterest profile URL" },
] as const

interface SocialNetworkTabProps {
  lead: Lead
  showEmpty: boolean
  onToggleEmpty: () => void
  onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void>
}

function profileHref(key: string, value: string) {
  if (key === "whatsapp") return `https://wa.me/${value.replace(/\D/g, "")}`
  return value
}

export function SocialNetworkTab({ lead, showEmpty, onToggleEmpty, onUpdateLead }: SocialNetworkTabProps) {
  const networks = lead.social_networks || {}
  const hiddenCount = NETWORKS.filter((network) => !hasPropertyValue(networks[network.key])).length

  const saveField = (key: typeof NETWORKS[number]["key"], value: string) =>
    onUpdateLead(lead.id, {
      social_networks: {
        ...networks,
        [key]: value || null,
      },
    })

  return (
    <div className="grid min-w-0">
      {NETWORKS.map((network) => {
        const value = networks[network.key] || ""
        const Icon = network.icon
        return (
          <PropertyRow
            key={network.key}
            icon={<Icon size={14} />}
            label={network.label}
            value={value}
            empty={!hasPropertyValue(value)}
            showEmpty={showEmpty}
            copyValue={value || undefined}
            linkHref={value ? profileHref(network.key, value) : undefined}
            editValue={value}
            onCommit={(next) => saveField(network.key, next)}
            renderEditor={(draft, setDraft) => (
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-8 text-sm"
                placeholder={network.placeholder}
              />
            )}
          />
        )
      })}
      <ShowEmptyFieldsToggle showEmpty={showEmpty} onToggle={onToggleEmpty} hiddenCount={hiddenCount} />
    </div>
  )
}
