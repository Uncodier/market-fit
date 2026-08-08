"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { DatePicker } from "@/app/components/ui/date-picker"
import { Plus, Trash2 } from "@/app/components/ui/icons"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { createPurchase, updatePurchase } from "@/app/purchases/actions"
import { getCompanies } from "@/app/companies/actions"
import { listCatalogItems } from "@/app/catalog/actions"
import { listLocations } from "@/app/inventory/actions"
import { CatalogItem, Location, Purchase, PurchaseLineInput } from "@/app/types"
import { Company } from "@/app/companies/types"
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut"

interface CreatePurchaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (purchaseId?: string) => void
  purchaseToEdit?: Purchase | null
}

type LineState = PurchaseLineInput & { key: string }

export function CreatePurchaseDialog({
  open,
  onOpenChange,
  onSuccess,
  purchaseToEdit = null,
}: CreatePurchaseDialogProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const isEditing = Boolean(purchaseToEdit?.id)
  const [loading, setLoading] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [title, setTitle] = useState("")
  const [vendorCompanyId, setVendorCompanyId] = useState<string>("")
  const [locationId, setLocationId] = useState<string>("")
  const [purchaseDate, setPurchaseDate] = useState<Date>(new Date())
  const [amountDue, setAmountDue] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<LineState[]>([
    { key: `line-${Date.now()}`, name: "", quantity: 1, unitCost: 0, catalogItemId: null },
  ])

  useEffect(() => {
    if (!open || !currentSite?.id) return
    ;(async () => {
      const [companiesRes, catalogRes, locationsRes] = await Promise.all([
        getCompanies(),
        listCatalogItems({ siteId: currentSite.id, pageSize: 200 }),
        listLocations(currentSite.id),
      ])
      if (companiesRes.companies) setCompanies(companiesRes.companies)
      if (catalogRes.data) setCatalogItems(catalogRes.data as CatalogItem[])
      const locs = locationsRes.data || []
      if (locs.length) setLocations(locs)

      if (purchaseToEdit) {
        setTitle(purchaseToEdit.title || "")
        setVendorCompanyId(purchaseToEdit.vendorCompanyId || "")
        setLocationId(purchaseToEdit.locationId || locs.find((l) => l.is_default)?.id || locs[0]?.id || "")
        setPurchaseDate(
          purchaseToEdit.purchaseDate ? new Date(purchaseToEdit.purchaseDate) : new Date()
        )
        setAmountDue(String(purchaseToEdit.amountDue ?? ""))
        setNotes(purchaseToEdit.notes || "")
        const editLines = (purchaseToEdit.items || []).map((item, idx) => ({
          key: `line-${item.id || idx}`,
          catalogItemId: item.catalogItemId || null,
          name: item.name,
          quantity: item.quantity,
          unitCost: item.unitCost,
        }))
        setLines(
          editLines.length
            ? editLines
            : [{ key: `line-${Date.now()}`, name: "", quantity: 1, unitCost: 0, catalogItemId: null }]
        )
      } else {
        const def = locs.find((l) => l.is_default) || locs[0]
        setLocationId(def?.id || "")
        setTitle(`Vendor bill - ${new Date().toLocaleDateString()}`)
        setAmountDue("")
        setNotes("")
        setVendorCompanyId("")
        setPurchaseDate(new Date())
        setLines([{ key: `line-${Date.now()}`, name: "", quantity: 1, unitCost: 0, catalogItemId: null }])
      }
    })()
  }, [open, currentSite?.id, purchaseToEdit?.id])

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0)

  const updateLine = (key: string, patch: Partial<LineState>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  }

  const onCatalogPick = (key: string, catalogItemId: string) => {
    if (catalogItemId === "custom") {
      updateLine(key, { catalogItemId: null })
      return
    }
    const item = catalogItems.find((c) => c.id === catalogItemId)
    updateLine(key, {
      catalogItemId,
      name: item?.name || "",
      unitCost: item?.cost != null ? Number(item.cost) : Number(item?.target_sale_price) || 0,
    })
  }

  const handleSubmit = async () => {
    if (!currentSite?.id) return
    const validLines = lines.filter((l) => l.name.trim() && Number(l.quantity) > 0)
    if (!validLines.length) {
      toast.error(t("bills.error.linesRequired") || "Add at least one line item")
      return
    }

    setLoading(true)
    try {
      const due =
        amountDue.trim() === ""
          ? total
          : Math.max(0, Math.min(total, Number(amountDue) || 0))

      const items = validLines.map((l) => ({
        catalogItemId: l.catalogItemId || null,
        name: l.name.trim(),
        quantity: Number(l.quantity),
        unitCost: Number(l.unitCost) || 0,
      }))

      const res = isEditing && purchaseToEdit
        ? await updatePurchase({
            siteId: currentSite.id,
            id: purchaseToEdit.id,
            title: title || "Vendor bill",
            vendorCompanyId: vendorCompanyId || null,
            purchaseDate: purchaseDate.toISOString().split("T")[0],
            locationId: locationId || null,
            notes: notes || null,
            amountDue: due,
            currency: currentSite.settings?.currency || purchaseToEdit.currency || "USD",
            status: due > 0
              ? (purchaseToEdit.status === "cancelled" ? "cancelled" : "pending")
              : (purchaseToEdit.status === "cancelled" ? "cancelled" : "completed"),
            items,
          })
        : await createPurchase({
            siteId: currentSite.id,
            title: title || "Vendor bill",
            vendorCompanyId: vendorCompanyId || null,
            purchaseDate: purchaseDate.toISOString().split("T")[0],
            locationId: locationId || null,
            notes: notes || null,
            amountDue: due,
            currency: currentSite.settings?.currency || "USD",
            status: due > 0 ? "pending" : "completed",
            items,
          })

      if (res.error || !res.purchase) {
        toast.error(res.error || (isEditing ? "Failed to update bill" : "Failed to create bill"))
        return
      }
      toast.success(
        isEditing
          ? (t("bills.success.updated") || "Bill updated")
          : (t("bills.success.created") || "Bill created")
      )
      onOpenChange(false)
      onSuccess?.(res.purchase.id)
    } catch (e) {
      console.error(e)
      toast.error(
        isEditing
          ? (t("bills.error.update") || "Failed to update bill")
          : (t("bills.error.create") || "Failed to create bill")
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? (t("bills.edit.title") || "Edit vendor bill")
              : (t("bills.create.title") || "New vendor bill")}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">{t("bills.field.title") || "Title"}</Label>
            <Input className="col-span-3" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">{t("bills.field.vendor") || "Vendor"}</Label>
            <div className="col-span-3">
              <Select value={vendorCompanyId || "none"} onValueChange={(v) => setVendorCompanyId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={t("bills.placeholder.vendor") || "Select vendor"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("bills.field.noVendor") || "No vendor"}</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">{t("bills.field.date") || "Date"}</Label>
            <div className="col-span-3">
              <DatePicker date={purchaseDate} setDate={(d) => setPurchaseDate(d)} className="h-12 w-full" />
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">{t("bills.field.location") || "Location"}</Label>
            <div className="col-span-3">
              <Select value={locationId || "none"} onValueChange={(v) => setLocationId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={t("bills.placeholder.location") || "Receive location"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("bills.field.noLocation") || "No location"}</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-md p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{t("bills.field.lines") || "Lines"}</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    { key: `line-${Date.now()}`, name: "", quantity: 1, unitCost: 0, catalogItemId: null },
                  ])
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                {t("bills.action.addLine") || "Add line"}
              </Button>
            </div>

            {lines.map((line) => (
              <div key={line.key} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4">
                  <Label className="text-xs">{t("bills.field.catalog") || "Catalog"}</Label>
                  <Select
                    value={line.catalogItemId || "custom"}
                    onValueChange={(v) => onCatalogPick(line.key, v)}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">{t("bills.field.customItem") || "Custom item"}</SelectItem>
                      {catalogItems.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">{t("bills.field.name") || "Name"}</Label>
                  <Input
                    value={line.name}
                    onChange={(e) => updateLine(line.key, { name: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">{t("bills.field.qty") || "Qty"}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">{t("bills.field.unitCost") || "Cost"}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.unitCost}
                    onChange={(e) => updateLine(line.key, { unitCost: Number(e.target.value) })}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={lines.length === 1}
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            <div className="text-right text-sm font-medium pt-2">
              {t("bills.field.total") || "Total"}: {formatCurrency(total)}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">{t("bills.field.amountDue") || "Amount due"}</Label>
            <Input
              className="col-span-3"
              type="number"
              min={0}
              step="0.01"
              placeholder={String(total)}
              value={amountDue}
              onChange={(e) => setAmountDue(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">{t("bills.field.notes") || "Notes"}</Label>
            <Textarea className="col-span-3" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {t("common.cancel") || "Cancel"}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading
              ? (t("common.saving") || "Saving...")
              : isEditing
                ? (t("bills.edit.submit") || "Save changes")
                : (t("bills.create.submit") || "Create bill")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
