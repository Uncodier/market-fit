"use client"

import { format } from "date-fns"
import { Input } from "@/app/components/ui/input"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { User, MessageSquare, Phone, Globe, Tag, FileText, Target } from "@/app/components/ui/icons"
import { CalendarDays } from "./custom-icons"
import { Lead, Segment } from "@/app/leads/types"
import { Campaign } from "@/app/types"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { PropertyRow, ShowEmptyFieldsToggle, hasPropertyValue } from "./PropertyRow"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { resolveRelationId } from "@/app/commerce/resolve-relation"

export const LEAD_LANGUAGES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
}

export function getLanguageName(languageCode: string | null) {
  if (!languageCode) return null
  return LEAD_LANGUAGES[languageCode] || languageCode
}

interface DetailsTabProps {
  lead: Lead
  segments: Segment[]
  campaigns: Campaign[]
  showEmpty: boolean
  onToggleEmpty: () => void
  onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void>
}

export function DetailsTab({
  lead,
  segments,
  campaigns,
  showEmpty,
  onToggleEmpty,
  onUpdateLead,
}: DetailsTabProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const getSegmentName = (segmentId: string | null) => {
    if (!segmentId) return ""
    return segments.find((segment) => segment.id === segmentId)?.name || "Unknown Segment"
  }
  const getCampaignName = (campaignId: string | null) => {
    if (!campaignId) return ""
    return campaigns.find((campaign) => campaign.id === campaignId)?.title || "Unknown Campaign"
  }

  const fields = [
    hasPropertyValue(lead.name),
    hasPropertyValue(lead.email),
    hasPropertyValue(lead.personal_email),
    hasPropertyValue(lead.phone),
    hasPropertyValue(lead.birthday),
    hasPropertyValue(lead.language),
    hasPropertyValue(lead.position),
    hasPropertyValue(lead.segment_id),
    hasPropertyValue(lead.campaign_id),
    hasPropertyValue(lead.origin),
  ]
  const hiddenCount = fields.filter((filled) => !filled).length

  const save = (data: Partial<Lead>) => onUpdateLead(lead.id, data)

  return (
    <div className="grid min-w-0">
      <PropertyRow
        icon={<User />}
        label="Name"
        value={lead.name}
        empty={!hasPropertyValue(lead.name)}
        showEmpty={showEmpty}
        editValue={lead.name}
        onCommit={(value) => save({ name: value })}
        renderEditor={(draft, setDraft) => (
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} className="h-8 text-sm" />
        )}
      />
      <PropertyRow
        icon={<MessageSquare />}
        label="Email"
        value={lead.email}
        empty={!hasPropertyValue(lead.email)}
        showEmpty={showEmpty}
        copyValue={lead.email || undefined}
        linkHref={lead.email ? `mailto:${lead.email}` : undefined}
        editValue={lead.email || ""}
        onCommit={(value) => save({ email: value })}
        renderEditor={(draft, setDraft) => (
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} className="h-8 text-sm" />
        )}
      />
      <PropertyRow
        icon={<MessageSquare />}
        label="Personal Email"
        value={lead.personal_email}
        empty={!hasPropertyValue(lead.personal_email)}
        showEmpty={showEmpty}
        copyValue={lead.personal_email || undefined}
        linkHref={lead.personal_email ? `mailto:${lead.personal_email}` : undefined}
        editValue={lead.personal_email || ""}
        onCommit={(value) => save({ personal_email: value || null })}
        renderEditor={(draft, setDraft) => (
          <Input type="email" value={draft} onChange={(event) => setDraft(event.target.value)} className="h-8 text-sm" />
        )}
      />
      <PropertyRow
        icon={<Phone />}
        label="Phone"
        value={lead.phone}
        empty={!hasPropertyValue(lead.phone)}
        showEmpty={showEmpty}
        copyValue={lead.phone || undefined}
        linkHref={lead.phone ? `tel:${lead.phone}` : undefined}
        editValue={lead.phone || ""}
        onCommit={(value) => save({ phone: value || null })}
        renderEditor={(draft, setDraft) => (
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} className="h-8 text-sm" />
        )}
      />
      <PropertyRow
        icon={<CalendarDays size={14} />}
        label="Birthday"
        value={lead.birthday ? new Date(lead.birthday).toLocaleDateString() : ""}
        empty={!hasPropertyValue(lead.birthday)}
        showEmpty={showEmpty}
        editValue={lead.birthday ? lead.birthday.split("T")[0] : ""}
        saveOnEnter={false}
        onCommit={(value) => save({ birthday: value || null })}
        renderEditor={(draft, setDraft) => (
          <DatePicker
            date={draft ? new Date(`${draft}T12:00:00`) : undefined}
            setDate={(next) => setDraft(format(next, "yyyy-MM-dd"))}
            className="w-full h-8"
            placeholder={t("datePicker.selectBirthday")}
          />
        )}
      />
      <PropertyRow
        icon={<Globe />}
        label="Language"
        value={getLanguageName(lead.language)}
        empty={!hasPropertyValue(lead.language)}
        showEmpty={showEmpty}
        editValue={lead.language || "none"}
        onCommit={(value) => save({ language: value === "none" ? null : value })}
        renderEditor={(draft, setDraft) => (
          <Select value={draft} onValueChange={setDraft}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {Object.entries(LEAD_LANGUAGES).map(([code, name]) => (
                <SelectItem key={code} value={code}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <PropertyRow
        icon={<User />}
        label="Position"
        value={lead.position}
        empty={!hasPropertyValue(lead.position)}
        showEmpty={showEmpty}
        editValue={lead.position || ""}
        onCommit={(value) => save({ position: value || null })}
        renderEditor={(draft, setDraft) => (
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} className="h-8 text-sm" />
        )}
      />
      <PropertyRow<RelationSelectValue>
        icon={<Tag />}
        label="Segment"
        value={getSegmentName(lead.segment_id)}
        empty={!hasPropertyValue(lead.segment_id)}
        showEmpty={showEmpty}
        editValue={
          lead.segment_id
            ? { mode: "existing", id: lead.segment_id, label: getSegmentName(lead.segment_id) }
            : null
        }
        onCommit={async (value) => {
          if (!currentSite?.id) return
          const { id, error } = await resolveRelationId("segment", value, currentSite.id)
          if (error) throw new Error(error)
          await save({ segment_id: id || null })
        }}
        renderEditor={(draft, setDraft) => (
          <RelationSelect
            options={segments.map((segment) => ({ id: segment.id, label: segment.name }))}
            value={draft}
            onValueChange={setDraft}
            placeholder="Select segment"
            emptyMessage="No segments found"
            className="h-8"
          />
        )}
      />
      <PropertyRow<RelationSelectValue>
        icon={<Target />}
        label="Campaign"
        value={getCampaignName(lead.campaign_id)}
        empty={!hasPropertyValue(lead.campaign_id)}
        showEmpty={showEmpty}
        editValue={
          lead.campaign_id
            ? { mode: "existing", id: lead.campaign_id, label: getCampaignName(lead.campaign_id) }
            : null
        }
        onCommit={async (value) => {
          if (!currentSite?.id) return
          const { id, error } = await resolveRelationId("campaign", value, currentSite.id)
          if (error) throw new Error(error)
          await save({ campaign_id: id || null })
        }}
        renderEditor={(draft, setDraft) => (
          <RelationSelect
            options={campaigns.map((campaign) => ({ id: campaign.id, label: campaign.title }))}
            value={draft}
            onValueChange={setDraft}
            placeholder="Select campaign"
            emptyMessage="No campaigns found"
            className="h-8"
          />
        )}
      />
      <PropertyRow
        icon={<FileText />}
        label="Origin"
        value={lead.origin}
        empty={!hasPropertyValue(lead.origin)}
        showEmpty={showEmpty}
        editValue={lead.origin || ""}
        onCommit={(value) => save({ origin: value || null })}
        renderEditor={(draft, setDraft) => (
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} className="h-8 text-sm" />
        )}
      />
      <ShowEmptyFieldsToggle showEmpty={showEmpty} onToggle={onToggleEmpty} hiddenCount={hiddenCount} />
    </div>
  )
}
