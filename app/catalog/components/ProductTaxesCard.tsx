"use client"

import { useEffect, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  listTaxes,
  getCatalogItemTaxes,
  addCatalogItemTax,
  removeCatalogItemTax,
  findOrCreateTax,
} from "../tax-actions"
import { Tax, CatalogItemTax } from "@/app/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { PlusCircle, Tag } from "@/app/components/ui/icons"
import { formatTaxRateLabel } from "@/app/commerce/taxes"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog"

interface ProductTaxesCardProps {
  catalogItemId: string
}

export function ProductTaxesCard({ catalogItemId }: ProductTaxesCardProps) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [linked, setLinked] = useState<CatalogItemTax[]>([])
  const [loading, setLoading] = useState(true)
  
  // Dialog state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newRate, setNewRate] = useState("16")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadData = async () => {
    if (!currentSite) return
    setLoading(true)
    try {
      const [linkedRes, taxesRes] = await Promise.all([
        getCatalogItemTaxes(catalogItemId),
        listTaxes(currentSite.id, true),
      ])
      if (linkedRes.error) toast.error(linkedRes.error)
      if (taxesRes.error) toast.error(taxesRes.error)
      setLinked(linkedRes.data || [])
      setTaxes(taxesRes.data || [])
    } catch {
      toast.error("Failed to load taxes")
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [catalogItemId, currentSite?.id])

  const handleToggleTax = async (tax: Tax, isLinked: boolean, linkId?: string) => {
    if (!currentSite) return

    try {
      if (isLinked && linkId) {
        const { error } = await removeCatalogItemTax(linkId)
        if (error) throw new Error(error)
        setLinked((prev) => prev.filter((l) => l.id !== linkId))
        toast.success(`Tax "${tax.name}" removed`)
      } else if (!isLinked) {
        const { data, error } = await addCatalogItemTax(currentSite.id, catalogItemId, tax.id)
        if (error) throw new Error(error)
        if (data) {
          setLinked((prev) => [...prev, data])
          toast.success(`Tax "${tax.name}" applied`)
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update tax status")
    }
  }

  const handleCreateTax = async () => {
    if (!currentSite) return
    const rateVal = parseFloat(newRate)
    
    if (!newName.trim()) {
      toast.error("Tax name is required")
      return
    }
    if (isNaN(rateVal) || rateVal < 0 || rateVal > 100) {
      toast.error("Enter a valid tax rate between 0 and 100")
      return
    }

    setIsSubmitting(true)
    try {
      const { tax, error } = await findOrCreateTax(currentSite.id, newName, rateVal)
      if (error) throw new Error(error)
      if (!tax) throw new Error("Failed to create tax")

      // Automatically link the newly created tax
      const { error: linkError } = await addCatalogItemTax(currentSite.id, catalogItemId, tax.id)
      if (linkError) {
        // If it's already linked we just silently ignore, but other errors throw
        if (linkError !== "Tax is already linked to this product") {
           throw new Error(linkError)
        }
      }

      toast.success("Tax created and applied successfully")
      setIsModalOpen(false)
      setNewName("")
      setNewRate("16")
      await loadData()
    } catch (err: any) {
      toast.error(err.message || "Failed to create tax")
    } finally {
      setIsSubmitting(false)
    }
  }

  const linkedTaxMap = new Map(linked.map((l) => [l.tax_id, l]))

  return (
    <Card id="product-taxes" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-6 md:px-8 py-6 flex flex-row items-center justify-between">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Tag className="h-5 w-5" /> Taxes
        </CardTitle>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <PlusCircle className="mr-2 h-4 w-4" /> Create Tax
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{t("catalog.taxes.create") || "Create New Tax"}</DialogTitle>
              <DialogDescription>
                Create a new tax rate for this site and automatically apply it to this product.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tax-name">{t("catalog.taxes.name") || "Name"}</Label>
                <Input
                  id="tax-name"
                  placeholder="e.g. VAT, Sales Tax"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-rate">Rate (%)</Label>
                <Input
                  id="tax-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleCreateTax} disabled={isSubmitting || !newName.trim()}>
                {isSubmitting ? "Creating..." : "Create Tax"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="px-6 md:px-8 pb-8">
        {loading ? (
          <div className="space-y-4">
            <div className="h-10 bg-muted/50 rounded animate-pulse" />
            <div className="h-10 bg-muted/50 rounded animate-pulse" />
          </div>
        ) : taxes.length > 0 ? (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-6 py-4 text-sm font-semibold text-left">{t("catalog.taxes.name") || "Tax Name"}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-left">{t("catalog.taxes.rate") || "Rate"}</th>
                  <th className="px-6 py-4 text-sm font-semibold text-right w-24">{t("catalog.taxes.active") || "Active"}</th>
                </tr>
              </thead>
              <tbody>
                {taxes.map((tax) => {
                  const link = linkedTaxMap.get(tax.id)
                  const isLinked = !!link
                  return (
                    <tr key={tax.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium">
                        {tax.name}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className="px-2 py-1 bg-muted/50 rounded-md">
                          {formatTaxRateLabel(tax.rate)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Switch
                          checked={isLinked}
                          onCheckedChange={() => handleToggleTax(tax, isLinked, link?.id)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
            <p className="text-muted-foreground text-sm">
              No taxes are configured for this site yet. Create one to apply it to products.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
