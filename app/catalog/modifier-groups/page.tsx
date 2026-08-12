"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listModifierGroups, upsertModifierGroup } from "../modifier-actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Skeleton } from "@/app/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Plus, Sliders } from "@/app/components/ui/icons"
import { toast } from "sonner"

export default function ModifierGroupsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")

  const { data, error, isLoading, mutate } = useSWR(
    currentSite?.id ? ["modifier-groups", currentSite.id, searchQuery] : null,
    async () => {
      const res = await listModifierGroups(currentSite!.id, searchQuery)
      if (res.error) throw new Error(res.error)
      return res.data
    },
  )

  useEffect(() => {
    const event = new CustomEvent("breadcrumb:update", {
      detail: {
        title: t("catalog.modifiers.groupsTitle") || "Modifier groups",
        parent: {
          title: t("layout.sidebar.catalog") || "Catalog",
          path: "/catalog",
        },
      },
    })
    window.dispatchEvent(event)
  }, [t])

  const handleCreate = async () => {
    if (!currentSite || !newName.trim()) return
    setCreating(true)
    try {
      const { data: created, error: createError } = await upsertModifierGroup({
        site_id: currentSite.id,
        name: newName.trim(),
      })
      if (createError) throw new Error(createError)
      toast.success(t("catalog.modifiers.successCreated") || "Modifier group created")
      setIsCreateOpen(false)
      setNewName("")
      mutate()
      if (created?.id) {
        window.location.href = `/catalog/modifier-groups/${created.id}`
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create group")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
      <StickyHeader>
        <div className="w-full pt-0 flex flex-col md:flex-row md:items-center gap-2 justify-between">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              mutate()
            }}
            className="w-full md:w-auto"
          >
            <SearchInput
              placeholder={t("catalog.modifiers.search") || "Search groups..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              alwaysExpanded={false}
            />
          </form>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("catalog.modifiers.create") || "New group"}
          </Button>
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        {!currentSite || isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center text-destructive py-8">
            {error.message}
          </div>
        ) : !data?.length ? (
          <EmptyCard
            icon={<Sliders className="h-12 w-12 text-muted-foreground/50" />}
            title={t("catalog.modifiers.emptyGroupsTitle") || "No modifier groups"}
            description={
              t("catalog.modifiers.emptyGroupsDesc") ||
              "Create a group of extra products (shots, milks, toppings) to attach to menu items."
            }
            actionButton={
              <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                {t("catalog.modifiers.create") || "New group"}
              </Button>
            }
          />
        ) : (
          <div className="border rounded-lg overflow-hidden bg-card">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-4 py-3 text-sm font-semibold text-left">
                    {t("catalog.modifiers.table.name") || "Group"}
                  </th>
                  <th className="px-4 py-3 text-sm font-semibold text-left">
                    {t("catalog.modifiers.table.selection") || "Selection"}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((group: any) => {
                  const min = group.min_select ?? 0
                  const max = group.max_select
                  const selectionLabel =
                    max == null
                      ? `${min}+`
                      : min === max
                        ? String(min)
                        : `${min}–${max}`
                  return (
                    <tr
                      key={group.id}
                      className="border-b last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 text-sm font-medium">
                        <Link
                          href={`/catalog/modifier-groups/${group.id}`}
                          className="hover:underline"
                        >
                          {group.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {selectionLabel}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {t("catalog.modifiers.createTitle") || "Create modifier group"}
            </DialogTitle>
            <DialogDescription>
              {t("catalog.modifiers.createDescription") ||
                "Name the group, then add catalog products as options."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>{t("catalog.modifiers.name") || "Name"}</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Coffee extras"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={creating}>
              {t("common.cancel") || "Cancel"}
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating
                ? t("common.creating") || "Creating..."
                : t("common.create") || "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
