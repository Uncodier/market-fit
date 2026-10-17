"use client"

import React, { useState, useEffect } from "react"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { Company } from "@/app/companies/types"
import { getCompanies } from "@/app/companies/actions"
import { toast } from "sonner"

interface CompanySelectorProps {
  initialValue: RelationSelectValue
  /** Reports the draft without creating a company until the parent saves. */
  onCompanyValueChange: (value: RelationSelectValue) => void
  isEditing: boolean
  hideLabel?: boolean
}

export function CompanySelector({
  initialValue,
  onCompanyValueChange,
  isEditing,
  hideLabel = false,
}: CompanySelectorProps) {
  const [companies, setCompanies] = useState<Company[]>([])
  // Keep the explicit selection separate from the parent's typed draft so that
  // search and asynchronous option loading cannot reset the input or hide Use.
  const [companyValue, setCompanyValue] = useState<RelationSelectValue>(initialValue)

  useEffect(() => {
    let cancelled = false
    const loadCompanies = async () => {
      try {
        const { companies: companiesData, error } = await getCompanies()
        if (cancelled) return
        if (error) {
          toast.error("Error loading companies")
          console.error(error)
          return
        }
        setCompanies(companiesData)
      } catch (error) {
        if (cancelled) return
        console.error("Error loading companies:", error)
        toast.error("Error loading companies")
      }
    }
    void loadCompanies()
    return () => { cancelled = true }
  }, [])

  const handleValueChange = (value: RelationSelectValue) => {
    setCompanyValue(value)
    onCompanyValueChange(value)
  }

  const handleSearchChange = (query: string) => {
    const name = query.trim()
    const company = companies.find((item) => item.name.toLowerCase() === name.toLowerCase())
    onCompanyValueChange(
      !name ? null : company
        ? { mode: "existing", id: company.id, label: query }
        : { mode: "create", label: query }
    )
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
        onInputValueChange={handleSearchChange}
        placeholder="Select company..."
        emptyMessage="No companies found"
      />
    </div>
  )
}
