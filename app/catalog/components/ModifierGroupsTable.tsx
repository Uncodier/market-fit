"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Skeleton } from "@/app/components/ui/skeleton"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Button } from "@/app/components/ui/button"
import { Plus, Sliders } from "@/app/components/ui/icons"
import { useLocalization } from "@/app/context/LocalizationContext"
import type { ModifierGroup } from "@/app/catalog/modifier-types"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  documentListShellClassName,
} from "@/app/components/documents/document-list"

function selectionLabel(group: ModifierGroup, unlimitedLabel: string) {
  const min = group.min_select ?? 0
  const max = group.max_select
  if (max == null) return min > 0 ? `${min}+` : unlimitedLabel
  if (min === max) return String(min)
  return `${min}–${max}`
}

export function ModifierGroupsTable({
  groups,
  onOpen,
  onCreate,
}: {
  groups: ModifierGroup[]
  onOpen: (id: string) => void
  onCreate: () => void
}) {
  const { t } = useLocalization()
  const unlimited = t("catalog.modifiers.unlimited") || "Unlimited"

  if (groups.length === 0) {
    return (
      <EmptyCard
        icon={<Sliders className="h-12 w-12 text-muted-foreground/50" />}
        title={t("catalog.modifiers.emptyGroupsTitle") || "No modifier groups"}
        description={
          t("catalog.modifiers.emptyGroupsDesc") ||
          "Create a group of extra products (shots, milks, toppings) to attach to menu items."
        }
        actionButton={
          <Button onClick={onCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            {t("catalog.modifiers.create") || "New group"}
          </Button>
        }
      />
    )
  }

  return (
    <div className={documentListShellClassName()}>
      <Table className="min-w-[560px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <DocumentListHead className="w-[70%]">
              {t("catalog.modifiers.table.name") || "Group"}
            </DocumentListHead>
            <DocumentListHead className="w-[30%]" align="right">
              {t("catalog.modifiers.table.selection") || "Selection"}
            </DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <DocumentListRow key={group.id} onClick={() => onOpen(group.id)}>
              <TableCell className="py-3.5">
                <EntityCell
                  name={group.name}
                  secondary={null}
                  secondaryMono={false}
                  meta={group.description || null}
                />
              </TableCell>
              <TableCell className="py-3.5 text-right">
                <span className="text-[15px] font-semibold tabular-nums tracking-tight">
                  {selectionLabel(group, unlimited)}
                </span>
              </TableCell>
            </DocumentListRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center border-t border-border/60 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{groups.length}</span>
          {" "}
          {groups.length === 1
            ? (t("catalog.modifiers.table.group") || "group")
            : (t("catalog.modifiers.table.groups") || "groups")}
        </p>
      </div>
    </div>
  )
}

export function ModifierGroupsTableSkeleton() {
  return (
    <div className={documentListShellClassName()}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <DocumentListHead>Group</DocumentListHead>
            <DocumentListHead align="right">Selection</DocumentListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 4 }).map((_, index) => (
            <TableRow key={index} className="hover:bg-transparent">
              <TableCell className="py-3.5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3.5">
                <Skeleton className="ml-auto h-4 w-10" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
