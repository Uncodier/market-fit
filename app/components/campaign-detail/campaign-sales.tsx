import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getCampaignSales, createSale, updateSale, deleteSale } from "@/app/campaigns/actions/sales"
import { PlusCircle } from "@/app/components/ui/icons"
import { CampaignSalesTable } from "./campaign-sales-table"
import { CreateSaleDialog, DeleteSaleDialog, EditSaleDialog } from "./campaign-sales-dialogs"

const emptySale = (campaignId: string) => ({
  title: "",
  amount: "",
  status: "completed",
  leadId: null as string | null,
  campaignId,
  segmentId: null as string | null,
  productName: "",
  saleDate: new Date().toISOString().split("T")[0],
  paymentMethod: "credit_card",
  source: "online",
  notes: "",
})

export function CampaignSales({ campaign }: { campaign: any }) {
  const [sales, setSales] = useState<any[]>([])
  const [loadingSales, setLoadingSales] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [newSale, setNewSale] = useState(emptySale(campaign.id))
  const [editingSale, setEditingSale] = useState<any | null>(null)
  const [isEditingSale, setIsEditingSale] = useState(false)
  const [isDeletingSale, setIsDeletingSale] = useState(false)
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null)

  useEffect(() => {
    if (campaign.id) loadSales()
  }, [campaign.id])

  const loadSales = async () => {
    try {
      setLoadingSales(true)
      const { data, error } = await getCampaignSales(campaign.id)
      if (error) {
        console.error("Error loading sales:", error)
        toast.error("Failed to load sales data")
      } else {
        setSales(data || [])
      }
    } catch (error) {
      console.error("Error in loadSales:", error)
      toast.error("An error occurred while loading sales")
    } finally {
      setLoadingSales(false)
    }
  }

  const handleNewSaleChange = (name: string, value: string) => {
    setNewSale((prev) => ({ ...prev, [name]: value }))
  }

  const handleCreateSale = async () => {
    if (!newSale.title || !newSale.amount || !newSale.saleDate) {
      toast.error("Please fill in all required fields")
      return
    }
    if (!currentSite) {
      toast.error("Site information is required")
      return
    }

    try {
      const { error } = await createSale({
        title: newSale.title,
        amount: parseFloat(newSale.amount),
        status: (newSale.status || "completed") as "pending" | "completed" | "cancelled" | "refunded",
        leadId: newSale.leadId,
        campaignId: campaign.id,
        segmentId: newSale.segmentId,
        productName: newSale.productName,
        saleDate: newSale.saleDate,
        paymentMethod: newSale.paymentMethod,
        source: newSale.source as "retail" | "online",
        notes: newSale.notes,
        siteId: currentSite.id,
        userId: currentSite.user_id,
      })

      if (error) {
        toast.error(`Failed to create sale: ${error}`)
        return
      }

      setNewSale(emptySale(campaign.id))
      setIsCreating(false)
      loadSales()
      toast.success("Sale created successfully")
    } catch (error) {
      console.error("Error creating sale:", error)
      toast.error("An error occurred while creating the sale")
    }
  }

  const handleEditSale = (sale: any) => {
    setEditingSale({
      id: sale.id,
      title: sale.title,
      amount: sale.amount.toString(),
      status: sale.status || "completed",
      productName: sale.productName || "",
      saleDate: sale.saleDate,
      paymentMethod: sale.paymentMethod || "credit_card",
      source: sale.source || "online",
    })
    setIsEditingSale(true)
  }

  const handleEditSaleChange = (name: string, value: string) => {
    setEditingSale((prev: any) => ({ ...prev, [name]: value }))
  }

  const handleUpdateSale = async () => {
    if (!editingSale?.id) {
      toast.error("Sale data is missing")
      return
    }
    if (!editingSale.amount || parseFloat(editingSale.amount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }

    try {
      const result = await updateSale(editingSale.id, {
        title: editingSale.title,
        amount: parseFloat(editingSale.amount),
        status: (editingSale.status || "completed") as "pending" | "completed" | "cancelled" | "refunded",
        productName: editingSale.productName,
        saleDate: editingSale.saleDate,
        paymentMethod: editingSale.paymentMethod,
        source: editingSale.source as "retail" | "online",
      })

      if (result.error) {
        toast.error(result.error)
        return
      }

      toast.success("Sale updated successfully")
      setIsEditingSale(false)
      loadSales()
    } catch (error) {
      console.error("Error updating sale:", error)
      toast.error("Failed to update sale")
    }
  }

  const handleDeleteSale = async () => {
    if (!saleToDelete) {
      toast.error("Sale ID is missing")
      return
    }

    try {
      const result = await deleteSale(saleToDelete)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Sale deleted successfully")
      setIsDeletingSale(false)
      setSaleToDelete(null)
      loadSales()
    } catch (error) {
      console.error("Error deleting sale:", error)
      toast.error("Failed to delete sale")
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium">
          {t("campaigns.detail.sales.title") || "Sales"}
        </h3>
        <Button variant="ghost" size="sm" className="h-8" onClick={() => setIsCreating(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          {t("campaigns.detail.sales.add") || "Add Sale"}
        </Button>
      </div>

      {loadingSales ? (
        <p className="text-sm text-muted-foreground py-3">Loading sales...</p>
      ) : (
        <CampaignSalesTable
          sales={sales}
          onEdit={handleEditSale}
          onDelete={(id) => {
            setSaleToDelete(id)
            setIsDeletingSale(true)
          }}
        />
      )}

      <CreateSaleDialog
        open={isCreating}
        onOpenChange={setIsCreating}
        values={newSale}
        onChange={handleNewSaleChange}
        onSubmit={handleCreateSale}
      />
      <EditSaleDialog
        open={isEditingSale}
        onOpenChange={setIsEditingSale}
        values={editingSale}
        onChange={handleEditSaleChange}
        onSubmit={handleUpdateSale}
      />
      <DeleteSaleDialog
        open={isDeletingSale}
        onOpenChange={setIsDeletingSale}
        onCancel={() => setSaleToDelete(null)}
        onConfirm={handleDeleteSale}
      />
    </div>
  )
}
