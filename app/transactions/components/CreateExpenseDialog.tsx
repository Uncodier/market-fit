"use client"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { resolveRelationId } from "@/app/commerce/resolve-relation"
import { createExpense, updateExpense } from "@/app/transactions/actions"
import { getActiveExpenseAccounts } from "@/app/accounting/chart"
import { AccountingAccount } from "@/app/types"
import { createClient } from "@/lib/supabase/client"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listLocations } from "@/app/inventory/actions"
import { useSite } from "@/app/context/SiteContext"
import { COMMON_CURRENCIES } from "@/app/lib/currencies"
import { Location } from "@/app/types"

interface CreateExpenseDialogProps {
  siteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  expenseToEdit?: any | null;
}

export function CreateExpenseDialog({ siteId, open, onOpenChange, onSuccess, expenseToEdit }: CreateExpenseDialogProps) {
  const { t } = useLocalization()
  const { currentSite } = useSite()
  const [loading, setLoading] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [expenseCategories, setExpenseCategories] = useState<AccountingAccount[]>([])

  const [formData, setFormData] = useState<{
    amount: string;
    currency: string;
    type: string;
    category: string;
    date: string;
    campaignValue: RelationSelectValue;
    locationValue: RelationSelectValue;
    notes: string;
  }>({
    amount: "",
    currency: currentSite?.settings?.currency || "USD",
    type: "fixed",
    category: "content",
    date: new Date().toISOString().split('T')[0],
    campaignValue: null,
    locationValue: null,
    notes: ""
  })

  // Load campaigns & locations for the site
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
      if (locRes.data) {
        setLocations(locRes.data)
      }
      
      const accounts = await getActiveExpenseAccounts(siteId)
      setExpenseCategories(accounts)
      if (accounts.length > 0 && !expenseToEdit) {
        setFormData(prev => ({
          ...prev,
          category: prev.category && accounts.some(a => (a.key || a.code) === prev.category)
            ? prev.category
            : (accounts[0].key || accounts[0].code),
        }))
      }
    }
    loadData()
  }, [siteId, open, expenseToEdit])

  // Set initial data if editing
  useEffect(() => {
    if (open) {
      if (expenseToEdit) {
        setFormData({
          amount: expenseToEdit.amount.toString(),
          currency: expenseToEdit.currency || currentSite?.settings?.currency || "USD",
          type: expenseToEdit.type || "fixed",
          category: expenseToEdit.category || "content",
          date: expenseToEdit.date || new Date().toISOString().split('T')[0],
          campaignValue: expenseToEdit.campaign_id ? { mode: "existing", id: expenseToEdit.campaign_id, label: campaigns.find(c => c.id === expenseToEdit.campaign_id)?.title || "" } : null,
          locationValue: expenseToEdit.location_id ? { mode: "existing", id: expenseToEdit.location_id, label: locations.find(l => l.id === expenseToEdit.location_id)?.name || "" } : null,
          notes: expenseToEdit.description || ""
        })
      } else {
        setFormData(prev => ({
          amount: "",
          currency: currentSite?.settings?.currency || "USD",
          type: "fixed",
          category: "content",
          date: new Date().toISOString().split('T')[0],
          campaignValue: null,
          locationValue: locations.length === 1 ? { mode: "existing", id: locations[0].id, label: locations[0].name } : null,
          notes: ""
        }))
      }
    }
  }, [open, expenseToEdit, campaigns, locations, currentSite])

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

      const payload = {
        siteId,
        type: formData.type as 'fixed' | 'variable',
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        category: formData.category,
        date: formData.date,
        description: formData.notes.trim() || undefined,
        campaignId: resolvedCampaignId,
        locationId: resolvedLocationId
      }

      const result = expenseToEdit 
        ? await updateExpense(expenseToEdit.id, payload)
        : await createExpense(payload)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(expenseToEdit 
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{expenseToEdit ? (t('expenses.edit.title') || "Edit Expense") : (t('expenses.create.title') || "Create Expense")}</DialogTitle>
            <DialogDescription>
              {expenseToEdit 
                ? (t('expenses.edit.desc') || "Update the details of this expense.") 
                : (t('expenses.create.desc') || "Add a new expense for your site.")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="amount" className="text-right">
                {t('expenses.field.amount') || "Amount"}
              </Label>
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
              <Label htmlFor="currency" className="text-right">
                Currency
              </Label>
              <div className="col-span-3">
                <Select value={formData.currency} onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}>
                  <SelectTrigger id="currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_CURRENCIES.map(opt => (
                      <SelectItem key={opt.code} value={opt.code}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                {t('expenses.field.type') || "Type"}
              </Label>
              <div className="col-span-3">
                <Select value={formData.type} onValueChange={(val) => setFormData(prev => ({ ...prev, type: val }))}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{t('expenses.type.fixed') || "Fixed"}</SelectItem>
                    <SelectItem value="variable">{t('expenses.type.variable') || "Variable"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="category" className="text-right">
                {t('expenses.field.category') || "Category"}
              </Label>
              <div className="col-span-3">
                <Select value={formData.category} onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(cat => (
                      <SelectItem key={cat.key || cat.code} value={cat.key || cat.code}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="date" className="text-right">
                {t('expenses.field.date') || "Date"}
              </Label>
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

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="campaign" className="text-right">
                {t('expenses.field.campaign') || "Campaign"}
              </Label>
              <div className="col-span-3">
                <RelationSelect
                  options={campaigns.map(c => ({ id: c.id, label: c.title }))}
                  value={formData.campaignValue}
                  onValueChange={(val) => setFormData(prev => ({ ...prev, campaignValue: val }))}
                  placeholder={t('expenses.placeholder.campaign') || "Select campaign (optional)"}
                  emptyMessage={t('expenses.empty.campaign') || "No campaigns found"}
                />
              </div>
            </div>
            
            {locations.length > 1 && (
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="location" className="text-right">
                  Location
                </Label>
                <div className="col-span-3">
                  <RelationSelect
                    options={locations.map(loc => ({ id: loc.id, label: loc.name }))}
                    value={formData.locationValue}
                    onValueChange={(val) => setFormData(prev => ({ ...prev, locationValue: val }))}
                    placeholder="Select location (optional)"
                    emptyMessage="No locations found"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="notes" className="text-right mt-2">
                {t('expenses.field.notes') || "Notes"}
              </Label>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {t('common.cancel') || "Cancel"}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (t('common.saving') || "Saving...") : (t('common.save') || "Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
