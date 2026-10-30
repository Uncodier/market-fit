"use client"

import { Building, Tag } from "@/app/components/ui/icons"
import { PropertyRow } from "@/app/leads/components/PropertyRow"
import { useProcurementI18n } from "@/app/purchases/procurement/i18n/use-procurement-i18n"
import { SupplierReferencePicker } from "./reference-picker"

export function SupplierReferenceProperty({ siteId, kind, selected, onChange, disabled }: {
  siteId: string; kind: "companies" | "categories"; selected: string[]; onChange: (ids: string[]) => void; disabled: boolean
}) {
  const { t } = useProcurementI18n()
  return <PropertyRow icon={kind === "companies" ? <Building /> : <Tag />} label={t(`procurement.partners.references.${kind}Label`)}
    multiline readOnly={disabled} editValue={selected} saveOnEnter={false} editorLayout="stacked"
    value={<SupplierReferencePicker key={`${siteId}:${kind}:${selected.join(',')}`} siteId={siteId} kind={kind} selected={selected} displayOnly onChange={() => {}} />}
    onCommit={async ids => { if (!disabled) onChange(ids) }}
    renderEditor={(draft, setDraft) => <SupplierReferencePicker siteId={siteId} kind={kind} selected={draft} onChange={setDraft} compact disabled={disabled} />}
  />
}