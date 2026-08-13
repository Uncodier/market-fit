"use client"

import { format } from "date-fns"
import { toast } from "sonner"
import { Input } from "@/app/components/ui/input"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { Building, Calendar, DollarSign, FileText } from "@/app/components/ui/icons"
import { Deal } from "@/app/deals/types"
import { getDealById, updateDeal } from "@/app/deals/actions"
import { CompanySelector } from "@/app/leads/components/CompanySelector"
import { PropertyRow, hasPropertyValue } from "@/app/leads/components/PropertyRow"
import { RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { DealTeamList } from "./DealTeamList"
import { DealContactsList } from "./DealContactsList"
import { formatDealCurrency } from "./deal-format"

const CURRENCIES = ["USD", "EUR", "GBP", "MXN", "CAD", "BRL"]

export function DealAboutPanel({
  deal,
  onUpdate,
}: {
  deal: Deal
  onUpdate: (deal: Deal) => void
}) {
  const companyName = deal.companies?.name || deal.company?.name || ""
  const companyValue: RelationSelectValue =
    deal.company_id && companyName
      ? { mode: "existing", id: deal.company_id, label: companyName }
      : null
  const closeDate = deal.expected_close_date
    ? new Date(deal.expected_close_date).toISOString().split("T")[0]
    : ""

  const save = async (data: Partial<Deal>) => {
    const result = await updateDeal({ id: deal.id, ...data })
    if (result.error) {
      toast.error(result.error)
      throw new Error(result.error)
    }
    if (result.deal) onUpdate(result.deal)
  }

  const saveCompany = async (value: RelationSelectValue) => {
    const { id, error } = await resolveRelationId("company", value, deal.site_id)
    if (error) throw new Error(error)
    const result = await updateDeal({ id: deal.id, company_id: id || null })
    if (result.error) {
      toast.error(result.error)
      throw new Error(result.error)
    }
    const updated = await getDealById(deal.id)
    if (updated.deal) onUpdate(updated.deal)
  }

  const createdLabel = new Date(deal.created_at).toLocaleDateString()
  const updatedLabel = deal.updated_at ? new Date(deal.updated_at).toLocaleDateString() : null

  return (
    <div className="w-full min-w-0">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
        About
      </p>
      <Tabs defaultValue="info" className="w-full min-w-0">
        <TabsList className="h-8 p-0.5 bg-muted/30 rounded-full w-full justify-start overflow-x-auto mb-3">
          <TabsTrigger value="info" className="h-7 px-3 rounded-full text-xs font-medium">
            Info
          </TabsTrigger>
          <TabsTrigger value="team" className="h-7 px-3 rounded-full text-xs font-medium">
            Team
          </TabsTrigger>
          <TabsTrigger value="contacts" className="h-7 px-3 rounded-full text-xs font-medium">
            Contacts
          </TabsTrigger>
          <TabsTrigger value="notes" className="h-7 px-3 rounded-full text-xs font-medium">
            Notes
            {hasPropertyValue(deal.notes) && (
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-0 min-w-0">
          <div className="grid min-w-0">
            <PropertyRow
              icon={<DollarSign />}
              label="Amount"
              value={formatDealCurrency(deal.amount, deal.currency) || ""}
              empty={!hasPropertyValue(deal.amount)}
              showEmpty
              editValue={deal.amount?.toString() || ""}
              onCommit={(value) => save({ amount: value ? parseFloat(value) : null })}
              renderEditor={(draft, setDraft) => (
                <Input
                  type="number"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="h-8 text-sm"
                />
              )}
            />
            <PropertyRow
              icon={<DollarSign />}
              label="Currency"
              value={deal.currency || "USD"}
              empty={!hasPropertyValue(deal.currency)}
              showEmpty
              editValue={deal.currency || "USD"}
              onCommit={(value) => save({ currency: value })}
              renderEditor={(draft, setDraft) => (
                <Select value={draft} onValueChange={setDraft}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <PropertyRow
              icon={<Calendar />}
              label="Close date"
              value={
                deal.expected_close_date
                  ? new Date(deal.expected_close_date).toLocaleDateString()
                  : ""
              }
              empty={!hasPropertyValue(deal.expected_close_date)}
              showEmpty
              editValue={closeDate}
              saveOnEnter={false}
              onCommit={(value) => save({ expected_close_date: value || null })}
              renderEditor={(draft, setDraft) => (
                <DatePicker
                  date={draft ? new Date(`${draft}T12:00:00`) : undefined}
                  setDate={(date) => setDraft(format(date, "yyyy-MM-dd"))}
                  className="w-full h-8"
                  placeholder="Select close date"
                />
              )}
            />
            <PropertyRow
              icon={<Building />}
              label="Company"
              value={companyName}
              empty={!hasPropertyValue(companyName)}
              showEmpty
              linkHref={deal.company_id ? `/companies/${deal.company_id}` : undefined}
              editValue={companyValue}
              onCommit={(value) => saveCompany(value)}
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
          </div>
        </TabsContent>

        <TabsContent value="team" className="mt-0 min-w-0">
          <DealTeamList deal={deal} onUpdate={onUpdate} />
        </TabsContent>
        <TabsContent value="contacts" className="mt-0 min-w-0">
          <DealContactsList deal={deal} onUpdate={onUpdate} />
        </TabsContent>
        <TabsContent value="notes" className="mt-0 min-w-0">
          <div className="grid min-w-0">
            <PropertyRow
              icon={<FileText />}
              label="Notes"
              value={deal.notes}
              empty={!hasPropertyValue(deal.notes)}
              showEmpty
              multiline
              editValue={deal.notes || ""}
              saveOnEnter={false}
              onCommit={(value) => save({ notes: value || null })}
              renderEditor={(draft, setDraft) => (
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="h-32 text-sm w-full rounded-md border border-input bg-background px-3 py-2 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring min-w-0"
                  placeholder="Add notes about the deal"
                />
              )}
            />
          </div>
        </TabsContent>
      </Tabs>

      <p className="text-[11px] text-muted-foreground mt-6">
        {createdLabel}
        {updatedLabel ? ` · Updated ${updatedLabel}` : ""}
      </p>
    </div>
  )
}
