"use client"

import { Input } from "@/app/components/ui/input"
import { MapPin } from "./custom-icons"
import { Lead } from "@/app/leads/types"
import { PropertyRow, ShowEmptyFieldsToggle, hasPropertyValue } from "./PropertyRow"

const ADDRESS_FIELDS = [
  { key: "street", label: "Street", placeholder: "Street address" },
  { key: "city", label: "City", placeholder: "City" },
  { key: "state", label: "State", placeholder: "State/Province" },
  { key: "zipcode", label: "ZIP Code", placeholder: "ZIP/Postal Code" },
  { key: "country", label: "Country", placeholder: "Country" },
] as const

interface AddressTabProps {
  lead: Lead
  showEmpty: boolean
  onToggleEmpty: () => void
  onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void>
}

export function AddressTab({ lead, showEmpty, onToggleEmpty, onUpdateLead }: AddressTabProps) {
  const address = lead.address || {}
  const hiddenCount = ADDRESS_FIELDS.filter((field) => !hasPropertyValue(address[field.key])).length

  const saveField = (key: typeof ADDRESS_FIELDS[number]["key"], value: string) =>
    onUpdateLead(lead.id, {
      address: {
        ...address,
        [key]: value || undefined,
      },
    })

  return (
    <div className="grid min-w-0">
      {ADDRESS_FIELDS.map((field) => (
        <PropertyRow
          key={field.key}
          icon={<MapPin size={14} />}
          label={field.label}
          value={address[field.key]}
          empty={!hasPropertyValue(address[field.key])}
          showEmpty={showEmpty}
          editValue={address[field.key] || ""}
          onCommit={(value) => saveField(field.key, value)}
          renderEditor={(draft, setDraft) => (
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-8 text-sm"
              placeholder={field.placeholder}
            />
          )}
        />
      ))}
      <ShowEmptyFieldsToggle showEmpty={showEmpty} onToggle={onToggleEmpty} hiddenCount={hiddenCount} />
    </div>
  )
}
