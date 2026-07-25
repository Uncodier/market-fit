import React, { useState, useEffect } from "react"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { Company } from "@/app/companies/types"
import { getCompanies } from "@/app/companies/actions"
import { toast } from "sonner"

interface CompanySelectorProps {
  selectedCompanyId: string | null
  initialCompany?: { id: string; name: string } | null
  onCompanyChange: (company: Company | null) => void
  /** Called when user picks a pending create; parent should resolve on save */
  onCompanyValueChange?: (value: RelationSelectValue) => void
  isEditing: boolean
  hideLabel?: boolean
}

export function CompanySelector({
  selectedCompanyId,
  initialCompany,
  onCompanyChange,
  onCompanyValueChange,
  isEditing,
  hideLabel = false,
}: CompanySelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  const [companyValue, setCompanyValue] = useState<RelationSelectValue>(
    initialCompany
      ? { mode: "existing", id: initialCompany.id, label: initialCompany.name }
      : null
  )

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    if (!selectedCompanyId) {
      setCompanyValue(null)
      return
    }

    if (companies.length > 0) {
      const company = companies.find((c) => c.id === selectedCompanyId)
      if (company) {
        setCompanyValue({ mode: "existing", id: company.id, label: company.name })
      } else if (initialCompany && initialCompany.id === selectedCompanyId) {
        setCompanyValue({
          mode: "existing",
          id: initialCompany.id,
          label: initialCompany.name,
        })
      }
    } else if (initialCompany && initialCompany.id === selectedCompanyId) {
      setCompanyValue({
        mode: "existing",
        id: initialCompany.id,
        label: initialCompany.name,
      })
    }
  }, [selectedCompanyId, companies, initialCompany?.id, initialCompany?.name])

  const loadCompanies = async () => {
    try {
      const { companies: companiesData, error } = await getCompanies()
      if (error) {
        toast.error("Error loading companies")
        console.error(error)
        return
      }
      setCompanies(companiesData)
    } catch (error) {
      console.error("Error loading companies:", error)
      toast.error("Error loading companies")
    }
  }

  const handleValueChange = (value: RelationSelectValue) => {
    setCompanyValue(value)
    onCompanyValueChange?.(value)

    if (value?.mode === "existing") {
      const company = companies.find((c) => c.id === value.id) || null
      onCompanyChange(company)
    } else if (value?.mode === "create") {
      // Do not write a fake id into company_id; parent resolves via onCompanyValueChange
      onCompanyChange({ id: "", name: value.label } as Company)
    } else {
      onCompanyChange(null)
    }
  }

  if (!isEditing) {
    return (
      <div className="flex-1">
        {!hideLabel && (
          <p className="text-xs text-muted-foreground mb-[5px]">Company</p>
        )}
        <p className="text-sm font-medium">
          {companyValue ? companyValue.label : "Not specified"}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1">
      {!hideLabel && (
        <p className="text-xs text-muted-foreground mb-[5px]">Company</p>
      )}
      <RelationSelect
        options={companies.map((c) => ({ id: c.id, label: c.name }))}
        value={companyValue}
        onValueChange={handleValueChange}
        placeholder="Select company..."
        emptyMessage="No companies found"
      />
    </div>
  )
}
