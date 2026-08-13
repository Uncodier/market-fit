"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { listModifierGroups, upsertModifierGroup } from "../modifier-actions"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
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
import { toast } from "sonner"
import {
  ModifierGroupsTable,
  ModifierGroupsTableSkeleton,
} from "../components/ModifierGroupsTable"

export default function ModifierGroupsPage() {
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()
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

  useEffect(() => {
    const handleCreate = () => setIsCreateOpen(true)
    window.addEventListener("modifier-groups:create", handleCreate)
    return () => window.removeEventListener("modifier-groups:create", handleCreate)
  }, [])

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
        router.push(`/catalog/modifier-groups/${created.id}`)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create group")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))]">
      <StickyHeader>
        <div className="w-full pt-0 flex flex-col md:flex-row md:items-center gap-2">
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
        </div>
      </StickyHeader>

      <div className="flex-1 p-4 md:p-6 overflow-auto">
        {!currentSite || isLoading ? (
          <ModifierGroupsTableSkeleton />
        ) : error ? (
          <div className="text-center text-destructive py-8">
            {error.message}
          </div>
        ) : (
          <ModifierGroupsTable
            groups={data || []}
            onOpen={(id) => router.push(`/catalog/modifier-groups/${id}`)}
            onCreate={() => setIsCreateOpen(true)}
          />
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
