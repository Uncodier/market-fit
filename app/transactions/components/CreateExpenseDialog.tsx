"use client"

import React, { useMemo, useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { createExpense, updateExpense } from "@/app/transactions/actions"
import { getActiveExpenseAccounts } from "@/app/accounting/chart"
import { upsertPolizaForExpense, removePolizaForSource } from "@/app/accounting/ensure"
import { AccountingAccount, CatalogItem, CatalogCategory, Location } from "@/app/types"
import { Lead } from "@/app/leads/types"
import { createClient } from "@/lib/supabase/client"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listLocations } from "@/app/inventory/actions"
import { listCatalogItems, listCatalogCategories } from "@/app/catalog/actions"
import { getLeads } from "@/app/leads/actions"
import { useSite } from "@/app/context/SiteContext"
import { COMMON_CURRENCIES } from "@/app/lib/currencies"
import { ExpenseAttributionFields } from "./ExpenseAttributionFields"

interface CreateExpenseDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  expenseToEdit?: any | null;
}

type FormData = {
  amount: string;
  currency: string;
  type: string;
  category: string;
  date: string;
  campaignValue: RelationSelectValue;
  locationValue: RelationSelectValue;
  catalogItemValue: RelationSelectValue;
  catalogCategoryValue: RelationSelectValue;
  leadValue: RelationSelectValue;
  notes: string;
}

export function CreateExpenseDialog({ siteId, open, onOpenChange, onSuccess, expenseToEdit }: CreateExpenseDialogProps) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [loading, setLoading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [expenseCategories, setExpenseCategories] = useState<AccountingAccount[]>([])

  const isEditing = Boolean(expenseToEdit?.id)
  const accountingState =
    expenseToEdit?.accountingState || expenseToEdit?.accounting_state || "pending"

  const [formData, setFormData] = useState<FormData>({
    amount: "",
    currency: currentSite?.settings?.currency || "USD",
    type: "fixed",
    category: "content",
    date: new Date().toISOString().split('T')[0],
    campaignValue: null,
    locationValue: null,
    catalogItemValue: null,
    catalogCategoryValue: null,
    leadValue: null,
    notes: ""
  })

  useEffect(() => {
    async function loadData() {
      if (!siteId || !open) return;
      const supabase = createClient()
      const { data } = await supabase
        .from('campaigns')
        .select('id, title')
        .eq('site_id', siteId)
        .order('title')
      if (data) setCampaigns(data)

      const locRes = await listLocations(siteId)
      if (locRes.data) setLocations(locRes.data)

      const itemsRes = await listCatalogItems({ siteId, pageSize: 200 })
      if (itemsRes.data) setCatalogItems(itemsRes.data as CatalogItem[])

      const catRes = await listCatalogCategories(siteId)
      if (catRes.data) setCatalogCategories(catRes.data as CatalogCategory[])

      const leadsRes = await getLeads(siteId)
      if (leadsRes.leads) setLeads(leadsRes.leads)

      const accounts = await getActiveExpenseAccounts(siteId)
      setExpenseCategories(accounts)
      if (accounts.length > 0 && !isEditing) {
        setFormData(prev => ({
          ...prev,
          category: prev.category && accounts.some(a => (a.key || a.code) === prev.category)
            ? prev.category
            : (accounts[0].key || accounts[0].code),
        }))
      }
    }
    loadData()
  }, [siteId, open, isEditing])

  useEffect(() => {
    if (!open) return

    const campaignId = expenseToEdit?.campaignId || expenseToEdit?.campaign_id || null
    const locationId = expenseToEdit?.locationId || expenseToEdit?.location_id || null
    const catalogItemId = expenseToEdit?.catalogItemId || expenseToEdit?.catalog_item_id || null
    const catalogCategoryId = expenseToEdit?.catalogCategoryId || expenseToEdit?.catalog_category_id || null
    const leadId = expenseToEdit?.leadId || expenseToEdit?.lead_id || null

    if (isEditing || expenseToEdit) {
      setFormData({
        amount: expenseToEdit?.amount != null ? String(expenseToEdit.amount) : "",
        currency: expenseToEdit?.currency || currentSite?.settings?.currency || "USD",
        type: expenseToEdit?.type || "fixed",
        category: expenseToEdit?.category || "content",
        date: expenseToEdit?.date || new Date().toISOString().split('T')[0],
        campaignValue: campaignId
          ? { mode: "existing", id: campaignId, label: campaigns.find(c => c.id === campaignId)?.title || "" }
          : null,
        locationValue: locationId
          ? { mode: "existing", id: locationId, label: locations.find(l => l.id === locationId)?.name || "" }
          : (!isEditing && locations.length === 1
            ? { mode: "existing", id: locations[0].id, label: locations[0].name }
            : null),
        catalogItemValue: catalogItemId
          ? { mode: "existing", id: catalogItemId, label: catalogItems.find(i => i.id === catalogItemId)?.name || "" }
          : null,
        catalogCategoryValue: catalogCategoryId
          ? { mode: "existing", id: catalogCategoryId, label: catalogCategories.find(c => c.id === catalogCategoryId)?.name || "" }
          : null,
        leadValue: leadId
          ? { mode: "existing", id: leadId, label: leads.find(l => l.id === leadId)?.name || "" }
          : null,
        notes: expenseToEdit?.description || ""
      })
    } else {
      setFormData(prev => ({
        amount: "",
        currency: currentSite?.settings?.currency || "USD",
        type: "fixed",
        category: prev.category || "content",
        date: new Date().toISOString().split('T')[0],
        campaignValue: null,
        locationValue: locations.length === 1
          ? { mode: "existing", id: locations[0].id, label: locations[0].name }
          : null,
        catalogItemValue: null,
        catalogCategoryValue: null,
        leadValue: null,
        notes: ""
      }))
    }
  }, [open, expenseToEdit, isEditing, campaigns, locations, catalogItems, catalogCategories, leads, currentSite])

  const effectiveAccountLabel = useMemo(() => {
    const categoryKey = formData.category
    const selectedCategory = expenseCategories.find(a => (a.key || a.code) === categoryKey)
    let label = selectedCategory?.label || categoryKey

    if (categoryKey === 'cogs') {
      const catId =
        (formData.catalogCategoryValue?.mode === 'existing' && formData.catalogCategoryValue.id) ||
        (formData.catalogItemValue?.mode === 'existing'
          ? catalogItems.find(i => i.id === formData.catalogItemValue!.id)?.category_id
          : null)
      const cat = catalogCategories.find(c => c.id === catId)
      if (cat?.cogs_account_key) {
        const override = expenseCategories.find(a => (a.key || a.code) === cat.cogs_account_key)
        label = override?.label || cat.cogs_account_key
      }
    }
    return label
  }, [formData, expenseCategories, catalogCategories, catalogItems])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.amount || isNaN(parseFloat(formData.amount))) {
      toast.error(t('expenses.error.invalidAmount') || "Please enter a valid amount")
      return
    }

    setLoading(true)
    try {
      const { id: resolvedCampaignId, error: campaignError } = await resolveRelationId("campaign", formData.campaignValue, siteId)
      if (campaignError) throw new Error(`Campaign error: ${campaignError}`)

      const { id: resolvedLocationId, error: locationError } = await resolveRelationId("location", formData.locationValue, siteId)
      if (locationError) throw new Error(`Location error: ${locationError}`)

      const { id: resolvedLeadId, error: leadError } = await resolveRelationId("lead", formData.leadValue, siteId)
      if (leadError) throw new Error(`Lead error: ${leadError}`)

      const { id: resolvedCatalogItemId, error: catalogItemError } = await resolveRelationId("catalog_item", formData.catalogItemValue, siteId)
      if (catalogItemError) throw new Error(`Catalog item error: ${catalogItemError}`)

      let resolvedCatalogCategoryId: string | null = null
      if (formData.catalogCategoryValue) {
        const { id, error } = await resolveRelationId("catalog_category", formData.catalogCategoryValue, siteId)
        if (error) throw new Error(`Catalog category error: ${error}`)
        resolvedCatalogCategoryId = id
      } else if (resolvedCatalogItemId) {
        resolvedCatalogCategoryId = catalogItems.find(i => i.id === resolvedCatalogItemId)?.category_id || null
      }

      const payload = {
        siteId,
        type: formData.type as 'fixed' | 'variable',
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        category: formData.category,
        date: formData.date,
        description: formData.notes.trim() || undefined,
        campaignId: resolvedCampaignId,
        locationId: resolvedLocationId,
        leadId: resolvedLeadId,
        catalogItemId: resolvedCatalogItemId,
        catalogCategoryId: resolvedCatalogCategoryId
      }

      const result = isEditing
        ? await updateExpense(expenseToEdit.id, payload)
        : await createExpense(payload)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing
          ? (t('expenses.success.updated') || "Expense updated successfully")
          : (t('expenses.success.created') || "Expense created successfully"))
        onOpenChange(false)
        onSuccess()
      }
    } catch (error) {
      console.error("Error saving expense:", error)
      toast.error(t('expenses.error.save') || "Failed to save expense")
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    if (!isEditing || !expenseToEdit?.id) return
    if (parseFloat(formData.amount || "0") <= 0) {
      toast.error(t('expenses.error.publishAmount') || "Amount must be greater than zero to publish")
      return
    }
    setPublishing(true)
    try {
      await upsertPolizaForExpense(expenseToEdit.id, siteId)
      toast.success(t('expenses.success.published') || "Expense published to journal")
      onSuccess()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || (t('expenses.error.publish') || "Failed to publish"))
    } finally {
      setPublishing(false)
    }
  }

  const handleUnpublish = async () => {
    if (!isEditing || !expenseToEdit?.id) return
    setPublishing(true)
    try {
      await removePolizaForSource('expense', expenseToEdit.id)
      toast.success(t('expenses.success.unpublished') || "Expense unpublished")
      onSuccess()
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || (t('expenses.error.unpublish') || "Failed to unpublish"))
    } finally {
      setPublishing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? (t('expenses.edit.title') || "Edit Expense")
                : (t('expenses.create.title') || "Create Expense")}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? (t('expenses.edit.desc') || "Update the details of this expense.")
                : (t('expenses.create.desc') || "Add a new expense for your site.")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">{t('expenses.field.amount') || "Amount"}</Label>
              <div className="col-span-3">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="currency" className="text-right">{t('expenses.field.currency') || "Currency"}</Label>
              <div className="col-span-3">
                <Select value={formData.currency} onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}>
                  <SelectTrigger id="currency"><SelectValue placeholder={t('expenses.placeholder.currency') || "Select currency"} /></SelectTrigger>
                  <SelectContent>
                    {COMMON_CURRENCIES.map(opt => (
                      <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">{t('expenses.field.type') || "Type"}</Label>
              <div className="col-span-3">
                <Select value={formData.type} onValueChange={(val) => setFormData(prev => ({ ...prev, type: val }))}>
                  <SelectTrigger id="type"><SelectValue placeholder={t('expenses.placeholder.selectType') || "Select type"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{t('expenses.type.fixed') || "Fixed"}</SelectItem>
                    <SelectItem value="variable">{t('expenses.type.variable') || "Variable"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">{t('expenses.field.account') || "Account"}</Label>
              <div className="col-span-3 space-y-1">
                <Select value={formData.category} onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}>
                  <SelectTrigger id="category"><SelectValue placeholder={t('expenses.placeholder.selectAccount') || "Select account"} /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(cat => (
                      <SelectItem key={cat.key || cat.code} value={cat.key || cat.code}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('expenses.field.effectiveAccount') || "Effective account"}: {effectiveAccountLabel}
                </p>
              </div>
            </div>

            <ExpenseAttributionFields
              formData={formData}
              setFormData={setFormData}
              campaigns={campaigns}
              locations={locations}
              catalogItems={catalogItems}
              catalogCategories={catalogCategories}
              leads={leads}
              campaignPlaceholder={t('expenses.placeholder.campaign') || "Select campaign (optional)"}
              campaignEmpty={t('expenses.empty.campaign') || "No campaigns found"}
            />

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">{t('expenses.field.date') || "Date"}</Label>
              <div className="col-span-3">
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="notes" className="text-right mt-2">{t('expenses.field.notes') || "Notes"}</Label>
              <div className="col-span-3">
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={t('expenses.placeholder.notes') || "Optional description"}
                  className="h-20"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
            <div className="flex gap-2">
              {isEditing && accountingState !== 'posted' && (
                <Button type="button" variant="outline" onClick={handlePublish} disabled={loading || publishing}>
                  {publishing ? (t('common.publishing') || "Publishing...") : (t('common.publish') || "Publish")}
                </Button>
              )}
              {isEditing && accountingState === 'posted' && (
                <Button type="button" variant="outline" onClick={handleUnpublish} disabled={loading || publishing}>
                  {publishing ? (t('common.saving') || "Saving...") : (t('common.cancel') || "Cancel")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading || publishing}>
                {t('common.close') || "Close"}
              </Button>
              <Button type="submit" disabled={loading || publishing}>
                {loading ? (t('common.saving') || "Saving...") : (t('common.save') || "Save")}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
