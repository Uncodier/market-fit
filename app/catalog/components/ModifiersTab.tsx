"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import {
  listCatalogItemModifierGroups,
  listModifierGroups,
  attachModifierGroupToCatalogItem,
  detachModifierGroupFromCatalogItem,
} from "../modifier-actions"
import { Button } from "@/app/components/ui/button"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
} from "@/app/components/ui/section-card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog"
import { Label } from "@/app/components/ui/label"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { RelationSelect, RelationSelectValue } from "@/app/components/ui/relation-select"
import { PlusCircle, Trash2, ModifierGroups } from "@/app/components/ui/icons"
import { toast } from "sonner"

export function ModifiersTab({ catalogItemId }: { catalogItemId: string }) {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [links, setLinks] = useState<any[]>([])
  const [availableGroups, setAvailableGroups] = useState<any[]>([])
  const [groupValue, setGroupValue] = useState<RelationSelectValue>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const loadData = async () => {
    if (!currentSite || !catalogItemId) return
    setLoading(true)
    try {
      const [linksRes, groupsRes] = await Promise.all([
        listCatalogItemModifierGroups(catalogItemId),
        listModifierGroups(currentSite.id),
      ])
      if (linksRes.error) throw new Error(linksRes.error)
      if (groupsRes.error) throw new Error(groupsRes.error)
      setLinks(linksRes.data || [])
      setAvailableGroups(groupsRes.data || [])
    } catch {
      toast.error(t("catalog.modifiers.errorLoading") || "Failed to load modifiers")
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [catalogItemId, currentSite?.id])

  const handleAdd = async () => {
    if (!currentSite || !groupValue || groupValue.mode !== "existing") return
    setAdding(true)
    try {
      const { error } = await attachModifierGroupToCatalogItem(
        currentSite.id,
        catalogItemId,
        groupValue.id,
      )
      if (error) {
        toast.error(error)
      } else {
        toast.success(t("catalog.modifiers.successAttached") || "Modifier group attached")
        setGroupValue(null)
        setIsModalOpen(false)
        loadData()
      }
    } catch (err: any) {
      toast.error(err.message || t("catalog.modifiers.errorAttaching") || "Failed to attach group")
    } finally {
      setAdding(false)
    }
  }

  const handleRemove = async (linkId: string) => {
    const { error } = await detachModifierGroupFromCatalogItem(linkId, catalogItemId)
    if (error) {
      toast.error(error)
    } else {
      toast.success(t("catalog.modifiers.successDetached") || "Modifier group removed")
      loadData()
    }
  }

  if (loading) {
    return (
      <SectionCard>
        <SectionCardContent>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </SectionCardContent>
      </SectionCard>
    )
  }

  const attachedIds = new Set(links.map((l) => l.modifier_group_id))

  return (
    <SectionCard>
      <SectionCardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <SectionCardTitle className="flex items-center gap-2">
            <ModifierGroups className="h-5 w-5" />
            {t("catalog.modifiers.title") || "Modifiers"}
          </SectionCardTitle>
          <p className="text-xs text-muted-foreground">
            {t("catalog.modifiers.tabDescription") ||
              "Attach reusable modifier groups (extras) offered when selling this item."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/catalog/modifier-groups">
              {t("catalog.modifiers.manageGroups") || "Manage groups"}
            </Link>
          </Button>
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                {t("catalog.modifiers.attach") || "Attach group"}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>
                  {t("catalog.modifiers.attachTitle") || "Attach modifier group"}
                </DialogTitle>
                <DialogDescription>
                  {t("catalog.modifiers.attachDescription") ||
                    "Choose an existing modifier group to offer on this product."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <Label>{t("catalog.modifiers.group") || "Modifier group"}</Label>
                <RelationSelect
                  options={availableGroups
                    .filter((g) => !attachedIds.has(g.id))
                    .map((g) => ({ id: g.id, label: g.name }))}
                  value={groupValue}
                  onValueChange={setGroupValue}
                  placeholder={
                    t("catalog.modifiers.selectGroup") || "Select a group..."
                  }
                  emptyMessage={
                    t("catalog.modifiers.emptyGroups") || "No modifier groups available"
                  }
                  allowCreate={false}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={adding}
                >
                  {t("common.cancel") || "Cancel"}
                </Button>
                <Button
                  onClick={handleAdd}
                  disabled={!groupValue || groupValue.mode !== "existing" || adding}
                >
                  {adding
                    ? t("common.adding") || "Adding..."
                    : t("catalog.modifiers.attach") || "Attach group"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </SectionCardHeader>
      <SectionCardContent>
        {links.length > 0 ? (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-4 py-3 text-sm font-semibold text-left">
                    {t("catalog.modifiers.table.name") || "Group"}
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold text-left">
                    {t("catalog.modifiers.table.selection") || "Selection"}
                  </th>
                  <th className="px-4 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {links.map((link) => {
                  const group = link.modifier_group
                  const min = group?.min_select ?? 0
                  const max = group?.max_select
                  const selectionLabel =
                    max == null
                      ? `${min}+`
                      : min === max
                        ? String(min)
                        : `${min}–${max}`
                  return (
                    <tr key={link.id} className="border-b last:border-0">
                      <td className="px-4 py-3 text-sm font-medium">
                        {group?.name || t("catalog.modifiers.unknownGroup") || "Unknown group"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {selectionLabel}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(link.id)}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyCard
            icon={<ModifierGroups className="h-10 w-10 text-muted-foreground" />}
            title={t("catalog.modifiers.empty.title") || "No modifier groups"}
            description={
              t("catalog.modifiers.empty.desc") ||
              "Attach a modifier group so extras can be offered in POS when selling this item."
            }
            className="border-0 shadow-none bg-transparent"
          />
        )}
      </SectionCardContent>
    </SectionCard>
  )
}
