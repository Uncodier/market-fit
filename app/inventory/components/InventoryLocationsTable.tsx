"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { listLocations, upsertLocation } from "../actions"
import { Button } from "@/app/components/ui/button"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog"
import { Edit, MapPin, Plus } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  StatusDot,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

export function InventoryLocationsTable({ siteId }: { siteId?: string }) {
  const { t } = useLocalization()
  const { data, isLoading, mutate } = useSWR(siteId ? ["locations", siteId] : null, () => listLocations(siteId!))
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newLocName, setNewLocName] = useState("")

  useEffect(() => {
    const handleOpen = () => setIsDialogOpen(true)
    window.addEventListener("inventory:open-location-dialog-internal", handleOpen)
    window.addEventListener("inventory:open-location-dialog", handleOpen)
    return () => {
      window.removeEventListener("inventory:open-location-dialog-internal", handleOpen)
      window.removeEventListener("inventory:open-location-dialog", handleOpen)
    }
  }, [])

  const handleCreate = async () => {
    if (!newLocName.trim() || !siteId) return
    setSaving(true)
    const res = await upsertLocation({ site_id: siteId, name: newLocName.trim(), is_active: true, is_default: false })
    setSaving(false)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(t("inventory.locations.created") || "Location created")
      setIsDialogOpen(false)
      setNewLocName("")
      mutate()
    }
  }

  if (isLoading) return <Skeleton className="h-32 w-full" />

  const rows = data?.data || []

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg">{t("inventory.locations.title") || "Physical Locations"}</h3>
          <p className="text-sm text-muted-foreground">
            {t("inventory.locations.description") || "Manage store fronts, warehouses, and fulfillment centers."}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("inventory.locations.add") || "Add Location"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("inventory.locations.new") || "New Location"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("inventory.locations.name") || "Location Name"}</Label>
                <Input
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  placeholder={t("inventory.locations.placeholder") || "e.g. Downtown Store"}
                />
              </div>
              <Button onClick={handleCreate} disabled={saving} className="w-full">
                {saving ? (t("common.saving") || "Saving...") : (t("inventory.locations.create") || "Create Location")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rows.length === 0 ? (
        <EmptyCard
          icon={<MapPin className="h-6 w-6" />}
          title={t("inventory.locations.empty.title") || "No locations found"}
          description={t("inventory.locations.empty.description") || "Add a physical location to manage stock per store or warehouse."}
          actionButton={
            <Button onClick={() => setIsDialogOpen(true)} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              {t("inventory.locations.add") || "Add Location"}
            </Button>
          }
        />
      ) : (
        <div className={documentListShellClassName()}>
          <Table className="min-w-[560px]">
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <TableRow className="hover:bg-transparent">
                <DocumentListHead className="w-[50%]">{t("inventory.locations.name") || "Location"}</DocumentListHead>
                <DocumentListHead className="w-[30%]">{t("inventory.locations.status") || "Status"}</DocumentListHead>
                <DocumentListHead className="w-[20%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((loc: any) => {
                const status = loc.is_active ? "active" : "inactive"
                const statusLabel = loc.is_active
                  ? (t("inventory.locations.active") || "Active")
                  : (t("inventory.locations.inactive") || "Inactive")
                return (
                  <DocumentListRow
                    key={loc.id}
                    accent={loc.is_active ? "none" : "cancelled"}
                    className="cursor-default"
                  >
                    <TableCell className="py-3.5">
                      <EntityCell
                        name={loc.name}
                        secondary={loc.code || null}
                        meta={loc.is_default ? (t("inventory.locations.default") || "Default") : null}
                      />
                    </TableCell>
                    <TableCell className="py-3.5">
                      <StatusDot status={status} label={statusLabel} />
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <Button variant="ghost" size="icon" disabled>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </DocumentListRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
