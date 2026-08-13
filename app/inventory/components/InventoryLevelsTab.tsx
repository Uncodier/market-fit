"use client"

import useSWR from "swr"
import { toast } from "sonner"
import { listInventoryLevels, setInventoryLevel } from "../actions"
import { InventoryLevelWithCatalog } from "../types"
import { Location } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Pagination } from "@/app/components/ui/pagination"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Input } from "@/app/components/ui/input"
import { DatabaseIcon, PlusCircle, Printer } from "@/app/components/ui/icons"
import { usePrinter } from "@/lib/printer/hooks/use-printer"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { buildInventoryTraceValue, ticketBrandFromSite } from "@/lib/printer"
import { cn } from "@/lib/utils"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

export function InventoryLevelsTab({
  siteId,
  locations,
  page,
  setPage,
  pageSize,
  q,
  selectedLocation,
}: {
  siteId?: string
  locations: Location[]
  page: number
  setPage: (p: number) => void
  pageSize: number
  q: string
  selectedLocation: string
}) {
  const { printJob } = usePrinter()
  const { currentSite } = useSite()
  const { t } = useLocalization()

  const fetcher = async () => {
    const res = await listInventoryLevels({
      siteId: siteId!,
      page,
      pageSize,
      q,
      locationId: selectedLocation === "all" ? undefined : selectedLocation,
    })
    return res
  }

  const { data, error, isLoading, mutate } = useSWR(
    siteId ? ["inventory_levels", siteId, page, q, selectedLocation] : null,
    fetcher,
  )

  const handleUpdateQuantity = async (level: InventoryLevelWithCatalog, newQtyStr: string) => {
    if (!siteId) return
    const qty = parseInt(newQtyStr)
    if (isNaN(qty)) return

    const promise = setInventoryLevel(siteId, level.location_id, level.catalog_item_id, qty)
    toast.promise(promise, {
      loading: t("inventory.toast.updating") || "Updating stock...",
      success: t("inventory.toast.updated") || "Stock updated",
      error: t("inventory.toast.updateFailed") || "Failed to update stock",
    })
    await promise
    mutate()
  }

  const handlePrintLabel = async (level: InventoryLevelWithCatalog) => {
    const sku = level.catalog_item?.sku || level.catalog_item_id
    const location = locations.find((l) => l.id === level.location_id)
    const brand = ticketBrandFromSite(currentSite)
    const qrValue = buildInventoryTraceValue({
      sku,
      itemId: level.catalog_item_id,
      locationName: location?.name,
      locationCode: location?.code,
      quantity: level.quantity,
      siteName: brand.siteName,
    })
    try {
      await printJob({
        module: "inventory",
        template: "inventory-label",
        payload: {
          ...brand,
          name: level.catalog_item?.name || "Item",
          sku: level.catalog_item?.sku || null,
          qrValue,
          locationName: location?.name || null,
          locationCode: location?.code || null,
          quantity: level.quantity,
          itemId: level.catalog_item_id,
          printedAt: new Date().toISOString(),
        },
      })
    } catch (err: any) {
      toast.error(err?.message || (t("inventory.toast.printFailed") || "Print failed"))
    }
  }

  if (isLoading) {
    return (
      <div className={documentListShellClassName()}>
        <div className="p-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return <div className="p-6 text-center text-red-500">{t("inventory.error.load") || "Error loading inventory"}</div>
  }

  const rows = data?.data || []
  const totalCount = data?.count ?? 0
  const totalPages = Math.ceil(totalCount / pageSize)
  const indexOfFirstItem = (page - 1) * pageSize

  if (rows.length === 0) {
    return (
      <EmptyCard
        icon={<DatabaseIcon className="h-6 w-6" />}
        title={t("inventory.levels.empty.title") || "No stock levels found"}
        description={t("inventory.levels.empty.description") || "Stock is created when items are added to catalog with inventory tracking enabled."}
        actionButton={
          <Button onClick={() => window.dispatchEvent(new CustomEvent("inventory:create-stock"))} variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" />
            {t("inventory.levels.add") || "Add Stock"}
          </Button>
        }
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[640px]">
        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[42%]">{t("inventory.levels.item") || "Item"}</DocumentListHead>
            <DocumentListHead className="w-[24%]">{t("inventory.levels.location") || "Location"}</DocumentListHead>
            <DocumentListHead className="w-[20%]" align="right">{t("inventory.levels.quantity") || "Quantity"}</DocumentListHead>
            <DocumentListHead className="w-[14%]" align="right">{t("inventory.levels.label") || "Label"}</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((level) => {
            const loc = locations.find((l) => l.id === level.location_id)
            const qty = Number(level.quantity) || 0
            const locationMeta = loc?.is_default ? (t("inventory.levels.default") || "Default") : null
            return (
              <DocumentListRow key={level.id} accent={qty === 0 ? "due" : "none"} className="cursor-default">
                <TableCell className="py-3.5">
                  <EntityCell
                    name={level.catalog_item?.name || (t("inventory.levels.untitled") || "Untitled item")}
                    secondary={level.catalog_item?.sku || null}
                  />
                </TableCell>
                <TableCell className="py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-muted-foreground">{loc?.name || (t("inventory.levels.unknown") || "Unknown")}</p>
                    {locationMeta ? (
                      <p className="truncate text-[11px] text-muted-foreground/80">{locationMeta}</p>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="py-3.5" onClick={(event) => event.stopPropagation()}>
                  <div className="flex justify-end">
                    <Input
                      type="number"
                      defaultValue={level.quantity}
                      onBlur={(e) => {
                        if (e.target.value !== String(level.quantity)) {
                          handleUpdateQuantity(level, e.target.value)
                        }
                      }}
                      className={cn(
                        "h-8 w-24 text-right text-[15px] font-semibold tabular-nums tracking-tight",
                        qty === 0 && "text-amber-600 dark:text-amber-400"
                      )}
                    />
                  </div>
                </TableCell>
                <TableCell className="py-3.5 text-right" onClick={(event) => event.stopPropagation()}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => handlePrintLabel(level)}
                    aria-label={t("inventory.levels.print") || "Print label"}
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                </TableCell>
              </DocumentListRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + 1, totalCount)}</span>
          {" – "}
          <span className="font-medium text-foreground">{Math.min(indexOfFirstItem + rows.length, totalCount)}</span>
          {" of "}
          <span className="font-medium text-foreground">{totalCount}</span>
          {" "}
          {t("inventory.levels.items") || "items"}
        </p>
        {totalPages > 1 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>
    </div>
  )
}
