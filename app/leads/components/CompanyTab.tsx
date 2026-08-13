"use client"

import { useState, useEffect } from "react"
import { Globe, Tag, User } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import { MapPin } from "./custom-icons"
import { Lead } from "@/app/leads/types"
import { Company, COMPANY_INDUSTRIES, COMPANY_SIZES, COMPANY_ANNUAL_REVENUES } from "@/app/companies/types"
import { CompanySelector } from "./CompanySelector"
import { RelationSelectValue } from "@/app/components/ui/relation-select"
import { getCompanyById, updateCompany } from "@/app/companies/actions"
import { toast } from "sonner"
import { PropertyRow, ShowEmptyFieldsToggle, hasPropertyValue } from "./PropertyRow"
import { useSite } from "@/app/context/SiteContext"
import { resolveRelationId } from "@/app/commerce/resolve-relation"

interface CompanyTabProps {
  lead: Lead
  showEmpty: boolean
  onToggleEmpty: () => void
  onUpdateLead: (id: string, data: Partial<Lead>) => Promise<void>
}

function industryName(id?: string | null) {
  if (!id) return ""
  return COMPANY_INDUSTRIES.find((item) => item.id === id)?.name || id
}

function sizeName(id?: string | null) {
  if (!id) return ""
  return COMPANY_SIZES.find((item) => item.id === id)?.name || id
}

function revenueName(id?: string | null) {
  if (!id) return ""
  return COMPANY_ANNUAL_REVENUES.find((item) => item.id === id)?.name || id
}

function formatAddress(address?: Company["address"]) {
  if (!address) return ""
  return [address.street, address.city, address.state, address.zipcode, address.country]
    .filter(Boolean)
    .join(", ")
}

export function CompanyTab({ lead, showEmpty, onToggleEmpty, onUpdateLead }: CompanyTabProps) {
  const { currentSite } = useSite()
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(false)
  const [companyValue, setCompanyValue] = useState<RelationSelectValue>(
    lead.company_id
      ? { mode: "existing", id: lead.company_id, label: lead.company?.name || "Unknown" }
      : null
  )

  useEffect(() => {
    const loadCompanyData = async () => {
      if (companyValue?.mode === "create") {
        setSelectedCompany({ id: "", name: companyValue.label } as Company)
        return
      }

      const companyId = lead.company_id
      if (!companyId) {
        setSelectedCompany(null)
        return
      }

      setLoading(true)
      try {
        const { company, error } = await getCompanyById(companyId)
        if (error) {
          console.error("Error loading company:", error)
          return
        }
        setSelectedCompany(company)
      } catch (error) {
        console.error("Error loading company:", error)
      } finally {
        setLoading(false)
      }
    }

    void loadCompanyData()
  }, [lead.company_id, companyValue])

  const saveCompanyLink = async (value: RelationSelectValue) => {
    if (!currentSite?.id) return
    const { id, error } = await resolveRelationId("company", value, currentSite.id)
    if (error) throw new Error(error)
    await onUpdateLead(lead.id, { company_id: id || null })
    setCompanyValue(value)
  }

  const updateField = async (field: keyof Company, value: string) => {
    if (!selectedCompany?.id) return
    try {
      const { company: updatedCompany, error } = await updateCompany({
        id: selectedCompany.id,
        name: selectedCompany.name,
        [field]: value,
      })
      if (error) {
        toast.error("Error updating company")
        return
      }
      if (updatedCompany) setSelectedCompany(updatedCompany)
    } catch (error) {
      console.error("Error updating company:", error)
      toast.error("Error updating company")
    }
  }

  const companyFields = [
    hasPropertyValue(selectedCompany?.website),
    hasPropertyValue(selectedCompany?.industry),
    hasPropertyValue(selectedCompany?.size),
    hasPropertyValue(selectedCompany?.description),
    hasPropertyValue(formatAddress(selectedCompany?.address)),
    hasPropertyValue(selectedCompany?.annual_revenue),
    hasPropertyValue(selectedCompany?.founded),
  ]
  const hiddenCount = companyFields.filter((filled) => !filled).length

  return (
    <div className="grid min-w-0">
      <PropertyRow
        icon={<Globe />}
        label="Company"
        value={selectedCompany?.name || ""}
        empty={!selectedCompany}
        showEmpty
        linkHref={selectedCompany?.id ? `/companies/${selectedCompany.id}` : undefined}
        editValue={companyValue}
        onCommit={(value) => saveCompanyLink(value)}
        renderEditor={(draft, setDraft) => (
          <CompanySelector
            selectedCompanyId={draft?.mode === "existing" ? draft.id : null}
            initialCompany={
              draft?.mode === "existing" ? { id: draft.id, name: draft.label } : undefined
            }
            onCompanyChange={(company) => {
              setDraft(company ? { mode: "existing", id: company.id, label: company.name } : null)
            }}
            onCompanyValueChange={setDraft}
            isEditing
            hideLabel
          />
        )}
      />

      {loading ? (
        <p className="text-xs text-muted-foreground py-2">Loading company...</p>
      ) : selectedCompany?.id ? (
        <>
          <PropertyRow
            icon={<Globe />}
            label="Website"
            value={selectedCompany.website?.replace(/^https?:\/\//, "")}
            empty={!hasPropertyValue(selectedCompany.website)}
            showEmpty={showEmpty}
            copyValue={selectedCompany.website || undefined}
            linkHref={selectedCompany.website || undefined}
            editValue={selectedCompany.website || ""}
            onCommit={(value) => updateField("website", value)}
            renderEditor={(draft, setDraft) => (
              <Input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="h-8 text-sm"
              />
            )}
          />
          <PropertyRow
            icon={<Tag />}
            label="Industry"
            value={industryName(selectedCompany.industry)}
            empty={!hasPropertyValue(selectedCompany.industry)}
            showEmpty={showEmpty}
            readOnly
          />
          <PropertyRow
            icon={<User />}
            label="Company Size"
            value={sizeName(selectedCompany.size)}
            empty={!hasPropertyValue(selectedCompany.size)}
            showEmpty={showEmpty}
            readOnly
          />
          <PropertyRow
            icon={<Globe />}
            label="Description"
            value={selectedCompany.description}
            empty={!hasPropertyValue(selectedCompany.description)}
            showEmpty={showEmpty}
            multiline
            readOnly
          />
          <PropertyRow
            icon={<MapPin size={14} />}
            label="Address"
            value={formatAddress(selectedCompany.address)}
            empty={!hasPropertyValue(formatAddress(selectedCompany.address))}
            showEmpty={showEmpty}
            multiline
            readOnly
          />
          <PropertyRow
            icon={<Globe />}
            label="Annual Revenue"
            value={revenueName(selectedCompany.annual_revenue)}
            empty={!hasPropertyValue(selectedCompany.annual_revenue)}
            showEmpty={showEmpty}
            readOnly
          />
          <PropertyRow
            icon={<Globe />}
            label="Founded"
            value={selectedCompany.founded}
            empty={!hasPropertyValue(selectedCompany.founded)}
            showEmpty={showEmpty}
            readOnly
          />
          <ShowEmptyFieldsToggle showEmpty={showEmpty} onToggle={onToggleEmpty} hiddenCount={hiddenCount} />
        </>
      ) : null}
    </div>
  )
}
