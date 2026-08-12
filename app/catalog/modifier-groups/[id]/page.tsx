"use client"

import React, { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  getModifierGroup,
  upsertModifierGroup,
  deleteModifierGroup,
  listModifierGroupItems,
  addModifierGroupItem,
  removeModifierGroupItem,
} from "../../modifier-actions"
import { listCatalogItems } from "../../actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card"
import { ActionFooter } from "@/app/components/ui/card-footer"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { PlusCircle, Trash2, Package } from "@/app/components/ui/icons"
import { toast } from "sonner"

export default function ModifierGroupDetailPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = React.use(props.params)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [minSelect, setMinSelect] = useState("0")
  const [maxSelect, setMaxSelect] = useState("")
  const [items, setItems] = useState<any[]>([])
  const [availableItems, setAvailableItems] = useState<any[]>([])
  const [itemValue, setItemValue] = useState<RelationSelectValue>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [adding, setAdding] = useState(false)

  const load = async () => {
    if (!currentSite) return
    setLoading(true)
    try {
      const [groupRes, itemsRes, catalogRes] = await Promise.all([
        getModifierGroup(params.id),
        listModifierGroupItems(params.id),
        listCatalogItems({
          siteId: currentSite.id,
          status: "active",
          pageSize: 500,
        }),
      ])
      if (groupRes.error || !groupRes.data) throw new Error(groupRes.error || "Not found")
      setName(groupRes.data.name || "")
      setDescription(groupRes.data.description || "")
      setMinSelect(String(groupRes.data.min_select ?? 0))
      setMaxSelect(
        groupRes.data.max_select == null ? "" : String(groupRes.data.max_select),
      )
      setItems(itemsRes.data || [])
      setAvailableItems(catalogRes.data || [])
    } catch (err: any) {
      toast.error(err.message || "Failed to load group")
      router.push("/catalog/modifier-groups")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [params.id, currentSite?.id])

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: {
        title: name || t("catalog.modifiers.group") || "Modifier group",
        parent: {
          title: t("catalog.modifiers.groupsTitle") || "Modifier groups",
          path: "/catalog/modifier-groups",
        },
      },
    })
    window.dispatchEvent(event)
  }, [name, t])

  const handleSave = async () => {
    if (!currentSite) return
    setSaving(true)
    try {
      const maxRaw = maxSelect.trim()
      const { error } = await upsertModifierGroup({
        id: params.id,
        site_id: currentSite.id,
        name,
        description: description || null,
        min_select: Number(minSelect) || 0,
        max_select: maxRaw === "" ? null : Number(maxRaw),
      })
      if (error) throw new Error(error)
      toast.success(t("common.saved") || "Saved successfully")
    } catch (err: any) {
      toast.error(err.message || "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const handleAddItem = async () => {
    if (!currentSite || !itemValue || itemValue.mode !== "existing") return
    setAdding(true)
    try {
      const { error } = await addModifierGroupItem(
        currentSite.id,
        params.id,
        itemValue.id,
      )
      if (error) throw new Error(error)
      toast.success(t("catalog.modifiers.successItemAdded") || "Product added")
      setItemValue(null)
      setIsAddOpen(false)
      const itemsRes = await listModifierGroupItems(params.id)
      setItems(itemsRes.data || [])
    } catch (err: any) {
      toast.error(err.message || "Failed to add product")
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveItem = async (id: string) => {
    const { error } = await removeModifierGroupItem(id, params.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("catalog.modifiers.successItemRemoved") || "Product removed")
      setItems((prev) => prev.filter((i) => i.id !== id))
    }
  }

  const handleDelete = async () => {
    if (!currentSite) return
    setDeleting(true)
    const { error } = await deleteModifierGroup(currentSite.id, params.id)
    if (error) {
      toast.error(error)
      setDeleting(false)
    } else {
      toast.success(t("catalog.modifiers.successDeleted") || "Group deleted")
      router.push("/catalog/modifier-groups")
    }
  }

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const usedIds = new Set(items.map((i) => i.catalog_item_id))

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0 flex justify-between items-center">
          <h1 className="text-lg font-semibold">{name}</h1>
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving
              ? t("common.saving") || "Saving..."
              : t("common.saveChanges") || "Save Changes"}
          </Button>
        </div>
      </StickyHeader>

      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-[800px] space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {t("catalog.modifiers.detailsTitle") || "Group details"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("catalog.modifiers.name") || "Name"}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("catalog.modifiers.description") || "Description"}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("catalog.modifiers.minSelect") || "Min select"}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={minSelect}
                    onChange={(e) => setMinSelect(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {t("catalog.modifiers.maxSelect") || "Max select"}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={maxSelect}
                    onChange={(e) => setMaxSelect(e.target.value)}
                    placeholder={t("catalog.modifiers.unlimited") || "Unlimited"}
                  />
                </div>
              </div>
            </CardContent>
            <ActionFooter>
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving
                  ? t("common.saving") || "Saving..."
                  : t("common.saveChanges") || "Save Changes"}
              </Button>
            </ActionFooter>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>
                  {t("catalog.modifiers.optionsTitle") || "Products in group"}
                </CardTitle>
                <CardDescription>
                  {t("catalog.modifiers.optionsDesc") ||
                    "These catalog products can be added as extras when the group is attached to a host item."}
                </CardDescription>
              </div>
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {t("common.add") || "Add"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      {t("catalog.modifiers.addProductTitle") || "Add product"}
                    </DialogTitle>
                    <DialogDescription>
                      {t("catalog.modifiers.addProductDesc") ||
                        "Select a catalog product to offer as a modifier option."}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-2">
                    <Label>{t("catalog.modifiers.product") || "Product"}</Label>
                    <RelationSelect
                      options={availableItems
                        .filter((i) => !usedIds.has(i.id))
                        .map((i) => ({ id: i.id, label: i.name }))}
                      value={itemValue}
                      onValueChange={setItemValue}
                      placeholder={
                        t("catalog.modifiers.selectProduct") || "Select product..."
                      }
                      allowCreate={false}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddOpen(false)}
                      disabled={adding}
                    >
                      {t("common.cancel") || "Cancel"}
                    </Button>
                    <Button
                      onClick={handleAddItem}
                      disabled={!itemValue || itemValue.mode !== "existing" || adding}
                    >
                      {adding
                        ? t("common.adding") || "Adding..."
                        : t("common.add") || "Add"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {items.length > 0 ? (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="px-4 py-3 text-sm font-semibold text-left">
                          {t("catalog.planItems.table.name") || "Name"}
                        </th>
                        <th className="px-4 py-3 text-sm font-semibold text-left">
                          {t("catalog.modifiers.table.price") || "Price"}
                        </th>
                        <th className="px-4 py-3 w-16" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="px-4 py-3 text-sm font-medium">
                            {row.catalog_item?.name || "Unknown"}
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {Number(row.catalog_item?.target_sale_price || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(row.id)}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyCard
                  icon={<Package className="h-10 w-10 text-muted-foreground" />}
                  title={t("catalog.modifiers.emptyOptions") || "No products yet"}
                  description={
                    t("catalog.modifiers.emptyOptionsDesc") ||
                    "Add catalog products that customers can pick as extras."
                  }
                  className="border-0 shadow-none bg-transparent"
                />
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">
                {t("catalog.form.dangerZone") || "Danger Zone"}
              </CardTitle>
              <CardDescription className="text-destructive/80">
                {t("catalog.modifiers.deleteWarning") ||
                  "Deleting this group removes it from all products."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 size={16} />
                {t("catalog.modifiers.delete") || "Delete group"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("catalog.modifiers.delete") || "Delete group"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("catalog.modifiers.deleteConfirm") ||
                "Are you sure you want to delete this modifier group?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {t("common.cancel") || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={deleting}
              className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
            >
              {deleting
                ? t("common.deleting") || "Deleting..."
                : t("catalog.modifiers.delete") || "Delete group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
