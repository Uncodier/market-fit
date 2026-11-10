"use client"

import { useEffect, useState } from "react"
import { Tag } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Skeleton } from "@/app/components/ui/skeleton"
import { RelationSelect, type RelationSelectValue } from "@/app/components/ui/relation-select"
import { getLeadPriceListOptions } from "../price-list-actions"
import { PropertyRow } from "./PropertyRow"

interface Props {
  siteId: string
  value: string | null
  showEmpty: boolean
  onCommit: (id: string | null) => Promise<void>
}

export function LeadPriceListField({ siteId, value, showEmpty, onCommit }: Props) {
  const [loaded, setLoaded] = useState<{
    siteId: string; attempt: number; result: Awaited<ReturnType<typeof getLeadPriceListOptions>>
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const result = loaded?.siteId === siteId && loaded.attempt === attempt ? loaded.result : null
  useEffect(() => {
    let cancelled = false
    getLeadPriceListOptions(siteId)
      .then((result) => { if (!cancelled) setLoaded({ siteId, attempt, result }) })
      .catch(() => {
        if (!cancelled) setLoaded({ siteId, attempt, result: { data: [], error: "Could not load price lists." } })
      })
    return () => { cancelled = true }
  }, [siteId, attempt])

  const selected = result?.data.find((list) => list.id === value)
  const label = selected
    ? `${selected.name} (${selected.currency})${selected.is_active ? "" : " — Inactive"}`
    : "Unavailable price list"

  return (
    <div>
      <PropertyRow<RelationSelectValue>
        icon={<Tag />}
        label="Price list"
        value={!result ? <Skeleton className="h-4 w-28" aria-label="Loading price list" /> : label}
        empty={!value}
        showEmpty={showEmpty}
        readOnly={!result || Boolean(result.error)}
        editValue={value ? { mode: "existing", id: value, label } : null}
        saveOnEnter={false}
        onCommit={async (draft) => {
          if (draft?.mode === "create") throw new Error("Select an existing price list.")
          await onCommit(draft?.id || null)
        }}
        renderEditor={(draft, setDraft) => (
          <RelationSelect
            options={(result?.data || []).filter((list) => list.is_active).map((list) => ({
              id: list.id, label: `${list.name} (${list.currency})`,
            }))}
            value={draft}
            onValueChange={setDraft}
            allowCreate={false}
            label="Price list"
            placeholder="Select price list"
            emptyMessage="No active price lists found"
            clearLabel="Clear price list"
            className="h-8"
          />
        )}
      />
      {result?.error && (value || showEmpty) && (
        <div role="alert" className="text-xs text-destructive">
          {result.error}
          <Button variant="ghost" size="sm" onClick={() => setAttempt((previous) => previous + 1)}>Retry</Button>
        </div>
      )}
    </div>
  )
}