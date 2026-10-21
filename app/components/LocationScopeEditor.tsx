"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Button } from "@/app/components/ui/button"
import { NativeSelect } from "@/app/components/ui/native-select"
import { Input } from "@/app/components/ui/input"
import {
  locationScopeLabels, locationScopeTables, locationScopeListSchema, locationScopeSavedSchema,
  type LocationScopeList, type LocationScopeTable,
} from "./location-scope-schema"

export function LocationScopeEditor(props: { siteId: string; table?: LocationScopeTable; recordId?: string }) {
  // Tenant/detail changes discard drafts and prevent late requests from crossing scope.
  return <ScopeEditor key={`${props.siteId}:${props.table}:${props.recordId}`} {...props} />
}

function ScopeEditor({ siteId, table: fixedTable, recordId }: {
  siteId: string; table?: LocationScopeTable; recordId?: string
}) {
  const prefix = useId()
  const [table, setTable] = useState<LocationScopeTable>(fixedTable || "deals")
  const [page, setPage] = useState(0)
  const [revision, refresh] = useState(0)
  const [data, setData] = useState<LocationScopeList | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [refreshRequired, setRefreshRequired] = useState(false)
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null)
  const pending = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setData(null); setSelectedId(""); setLocationId(""); setRefreshRequired(false)
    const query = new URLSearchParams({ siteId, table, page: String(page), ...(recordId ? { id: recordId } : {}) })
    void (async () => {
      try {
        const response = await fetch(`/api/location-scope?${query}`, { cache: "no-store", signal: controller.signal })
        const body = await response.json()
        if (!response.ok) throw new Error(response.status === 403 ? "Only site owners and admins can assign location scope." : body.error || "Unable to load location scope.")
        const parsed = locationScopeListSchema.safeParse(body)
        if (!parsed.success || parsed.data.site_id !== siteId || parsed.data.table !== table || parsed.data.page !== page) {
          throw new Error("Location scope could not be verified.")
        }
        if (!controller.signal.aborted) {
          setData(parsed.data)
          if (recordId) setSelectedId(recordId)
        }
      } catch (error) {
        if (!controller.signal.aborted) setMessage({ error: true, text: error instanceof Error ? error.message : "Unable to load location scope." })
      } finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [siteId, table, page, recordId, revision])

  const selected = data?.records.find(row => row.id === selectedId)
  const canSave = !!selected && selected.location_id === null && !!locationId && !loading && !saving && !refreshRequired
  async function save() {
    if (!canSave || pending.current) return
    pending.current = true; setSaving(true); setMessage(null)
    try {
      const response = await fetch(`/api/location-scope?siteId=${encodeURIComponent(siteId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id: selectedId, locationId }),
      })
      const body = await response.json()
      const parsed = locationScopeSavedSchema.safeParse(body)
      if (!response.ok) throw new Error(body.error || "Assignment failed. Refresh before trying again.")
      if (!parsed.success || parsed.data.table !== table || parsed.data.id !== selectedId ||
        parsed.data.site_id !== siteId || parsed.data.location_id !== locationId) throw new Error("Assignment could not be confirmed. Refresh before trying again.")
      if (mounted.current) {
        setMessage({ error: false, text: "Location scope assigned." })
        refresh(value => value + 1)
      }
    } catch (error) {
      if (mounted.current) {
        setRefreshRequired(true)
        setMessage({ error: true, text: error instanceof Error ? error.message : "Assignment could not be confirmed. Refresh before trying again." })
      }
    } finally {
      pending.current = false
      if (mounted.current) setSaving(false)
    }
  }

  return <section aria-label="Canonical location scope" className="space-y-4 rounded-lg border p-4">
    <h2 className="text-lg font-semibold">Assign location scope</h2>
    <p className="text-sm text-muted-foreground">Owners and admins can assign an unresolved record to its operating branch. This does not change fulfillment origin or reservation resources. Existing assignments cannot be moved here.</p>
    {!fixedTable && <div className="space-y-2">
      <label htmlFor={`${prefix}-type`}>Record type</label>
      <NativeSelect id={`${prefix}-type`} value={table} disabled={saving} onChange={event => {
        setData(null); setLoading(true); setTable(event.target.value as LocationScopeTable); setPage(0); setMessage(null); setSearch("")
      }}>{locationScopeTables.map(value => <option key={value} value={value}>{locationScopeLabels[value]}</option>)}</NativeSelect>
    </div>}
    {loading && <p role="status">Loading location scope…</p>}
    {data && <>
      {!recordId && <Input aria-label="Filter records on this page" placeholder="Filter records on this page…" value={search} onChange={event => setSearch(event.target.value)} />}
      <div className="space-y-2">
        <label htmlFor={`${prefix}-record`}>{recordId ? "Record" : "Unresolved record"}</label>
        <NativeSelect id={`${prefix}-record`} value={selectedId} disabled={saving || !!recordId} onChange={event => { setSelectedId(event.target.value); setLocationId(""); setMessage(null) }}>
          <option value="">Select a record</option>
          {data.records.filter(row => row.id === selectedId || row.label.toLowerCase().includes(search.toLowerCase())).map(row => <option key={row.id} value={row.id}>{row.label}</option>)}
        </NativeSelect>
      </div>
      {!data.records.length && <p role="status">{recordId ? "Record not found." : "No unresolved records on this page."}</p>}
      {selected && <p className="text-xs text-muted-foreground break-all">Record ID: {selected.id}</p>}
      {selected?.location_id && <p role="status">Assigned branch: {data.locations.find(location => location.id === selected.location_id)?.name || selected.location_id}</p>}
      {selected?.location_id === null && <div className="space-y-2">
        <label htmlFor={`${prefix}-branch`}>Operating branch</label>
        <NativeSelect id={`${prefix}-branch`} value={locationId} disabled={saving || refreshRequired} onChange={event => setLocationId(event.target.value)}>
          <option value="">Choose the actual operating branch</option>
          {data.locations.map(location => <option key={location.id} value={location.id}>{location.name}{location.is_active === false ? " · inactive" : ""}</option>)}
        </NativeSelect>
        {!data.locations.length && <p role="status">No branches configured.</p>}
      </div>}
      {!recordId && <div className="flex items-center gap-2">
        <Button variant="outline" disabled={!page || saving} onClick={() => { setData(null); setLoading(true); setPage(value => value - 1) }}>Previous</Button>
        <span className="text-sm">Page {page + 1}</span>
        <Button variant="outline" disabled={!data.hasMore || saving} onClick={() => { setData(null); setLoading(true); setPage(value => value + 1) }}>Next</Button>
      </div>}
    </>}
    {message && <p role={message.error ? "alert" : "status"}>{message.text}</p>}
    <div className="flex gap-2">
      <Button disabled={!canSave} onClick={() => void save()}>{saving ? "Assigning…" : "Assign branch"}</Button>
      <Button variant="outline" disabled={loading || saving} onClick={() => { setMessage(null); refresh(value => value + 1) }}>Refresh</Button>
    </div>
  </section>
}