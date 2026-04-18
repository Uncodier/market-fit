"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  getAudienceLeadsByAudienceIdPage,
  type AudienceLeadRow,
} from "@/app/audiences/actions"
import { getLeadById } from "@/app/leads/actions"
import type { Lead } from "@/app/leads/types"
import {
  ImprentaLeadKanbanMiniCard,
  ImprentaLeadKanbanMiniCardSkeleton,
} from "@/app/components/agents/imprenta-lead-kanban-mini-card"
import { Button } from "@/app/components/ui/button"
import { ChevronLeft, ChevronRight } from "@/app/components/ui/icons"

function sortAudienceLeadRows(rows: AudienceLeadRow[]): AudienceLeadRow[] {
  return [...rows].sort((a, b) => {
    const ia = a.idx ?? a.page_number ?? Number.MAX_SAFE_INTEGER
    const ib = b.idx ?? b.page_number ?? Number.MAX_SAFE_INTEGER
    if (ia !== ib) return Number(ia) - Number(ib)
    const ta = a.created_at || ""
    const tb = b.created_at || ""
    return ta.localeCompare(tb)
  })
}

type Props = {
  audienceId: string
  /** Required to load full lead for the Kanban-style card. */
  siteId: string
  /** When the node result already includes `audience_leads`, paginate locally (no DB). */
  embeddedLeads?: AudienceLeadRow[] | null
}

function CarouselNavButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "prev" | "next"
  disabled: boolean
  onClick: () => void
}) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-7 w-7 shrink-0"
      disabled={disabled}
      onClick={onClick}
      aria-label={direction === "prev" ? "Previous lead" : "Next lead"}
    >
      <Icon className="h-4 w-4" />
    </Button>
  )
}

export function ImprentaAudienceLeadsCarousel({ audienceId, siteId, embeddedLeads }: Props) {
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [row, setRow] = useState<AudienceLeadRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [leadDetail, setLeadDetail] = useState<Lead | null>(null)
  const [leadLoading, setLeadLoading] = useState(false)
  const [leadErr, setLeadErr] = useState<string | null>(null)

  const embeddedSorted = useMemo(
    () => (embeddedLeads?.length ? sortAudienceLeadRows(embeddedLeads) : []),
    [embeddedLeads]
  )

  const loadRemote = useCallback(async () => {
    if (!audienceId.trim()) {
      setTotal(0)
      setRow(null)
      setErr(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    const res = await getAudienceLeadsByAudienceIdPage(audienceId, page, 1)
    if (res.error) {
      setErr(res.error)
      setRow(null)
      setTotal(0)
    } else {
      setTotal(res.total)
      setRow(res.rows[0] ?? null)
    }
    setLoading(false)
  }, [audienceId, page])

  useEffect(() => {
    if (embeddedSorted.length > 0) {
      setTotal(embeddedSorted.length)
      setRow(embeddedSorted[page] ?? null)
      setErr(null)
      setLoading(false)
      return
    }
    loadRemote()
  }, [audienceId, page, embeddedSorted, loadRemote])

  useEffect(() => {
    const leadId = row?.lead_id?.trim()
    if (!leadId || !siteId.trim()) {
      setLeadDetail(null)
      setLeadErr(null)
      setLeadLoading(false)
      return
    }
    let cancelled = false
    setLeadLoading(true)
    setLeadErr(null)
    setLeadDetail(null)
    void getLeadById(leadId, siteId).then((res) => {
      if (cancelled) return
      setLeadLoading(false)
      if (res.error || !res.lead) {
        setLeadErr(res.error || "Could not load lead")
        setLeadDetail(null)
      } else {
        setLeadDetail(res.lead as Lead)
      }
    })
    return () => {
      cancelled = true
    }
  }, [row?.id, row?.lead_id, siteId])

  const maxPage = Math.max(0, total - 1)
  const canPrev = page > 0
  const canNext = total > 0 && page < maxPage

  if (err) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 space-y-2 text-[10px]">
        <p className="text-destructive font-medium">Could not load audience leads</p>
        <p className="font-mono break-all text-muted-foreground">{err}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
      {loading ? (
        <div className="flex items-center gap-2">
          <CarouselNavButton
            direction="prev"
            disabled={!canPrev || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          />
          <div className="flex-1 min-w-0 flex justify-center">
            <ImprentaLeadKanbanMiniCardSkeleton />
          </div>
          <CarouselNavButton
            direction="next"
            disabled={!canNext || loading}
            onClick={() => setPage((p) => p + 1)}
          />
        </div>
      ) : !row ? (
        <div className="flex items-center gap-2">
          <CarouselNavButton
            direction="prev"
            disabled={!canPrev || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          />
          <div className="flex-1 min-w-0 text-xs text-muted-foreground py-2 space-y-1.5 text-center">
            <p className="font-medium text-amber-600 dark:text-amber-500">
              No audience leads found.
            </p>
            <p className="text-[10px] text-muted-foreground">
              Confirm the resolved audience has rows in <span className="font-mono">audience_leads</span>, or embed{" "}
              <span className="font-mono">audience_leads</span> in the node result.
            </p>
          </div>
          <CarouselNavButton
            direction="next"
            disabled={!canNext || loading}
            onClick={() => setPage((p) => p + 1)}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CarouselNavButton
              direction="prev"
              disabled={!canPrev || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            />
            <div className="flex-1 min-w-0 flex justify-center">
              {!row.lead_id?.trim() ? (
                <div className="text-xs text-muted-foreground text-center py-2 max-w-[320px] w-full">
                  This audience lead row has no <span className="font-mono">lead_id</span>.
                </div>
              ) : leadLoading ? (
                <ImprentaLeadKanbanMiniCardSkeleton />
              ) : leadErr ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2 text-[11px] max-w-[320px] w-full">
                  <p className="text-destructive font-medium">{leadErr}</p>
                  <Link
                    href={`/leads/${row.lead_id}`}
                    className="text-primary font-mono text-[10px] hover:underline break-all"
                  >
                    Open lead by id
                  </Link>
                </div>
              ) : leadDetail ? (
                <ImprentaLeadKanbanMiniCard
                  lead={leadDetail}
                  audienceSendStatus={row.send_status}
                />
              ) : null}
            </div>
            <CarouselNavButton
              direction="next"
              disabled={!canNext || loading}
              onClick={() => setPage((p) => p + 1)}
            />
          </div>
          <details className="text-[10px] text-muted-foreground border border-border/40 rounded-lg px-2 py-1.5">
            <summary className="cursor-pointer select-none font-medium text-foreground/80">
              Audience lead row
            </summary>
            <div className="mt-1.5 space-y-1 font-mono break-all">
              {row.idx != null ? <div>idx: {String(row.idx)}</div> : null}
              {typeof row.page_number === "number" ? <div>page_number: {row.page_number}</div> : null}
              <div>row id: {row.id}</div>
              <div>lead_id: {row.lead_id || "—"}</div>
              {row.sent_at ? <div>sent_at: {row.sent_at}</div> : null}
              {row.error ? <div className="text-destructive">error: {String(row.error)}</div> : null}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
