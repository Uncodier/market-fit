"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { getRecordTrash, restoreRecord, restoreRecordCategory } from "../actions"
import type { TrashItem } from "../trash-actions"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Button } from "@/app/components/ui/button"

interface Props {
  siteId: string
  onClose: () => void
  onRestored: () => void
}

// The page mounts a fresh dialog for each site/open, never reusing another site's list.
export function RecordsTrashDialog({ siteId, onClose, onRestored }: Props) {
  const [items, setItems] = useState<TrashItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const active = useRef(false)
  const busy = useRef(false)
  const request = useRef(0)

  const load = useCallback(() => {
    const current = ++request.current
    return getRecordTrash(siteId).then(result => {
      if (!active.current || current !== request.current) return
      if (result.error || !result.items) {
        setError(result.error || "Unable to load Trash")
        setItems([])
      } else setItems(result.items.filter(item => !item.deletion_root_category_id ||
        (item.kind === "category" && item.id === item.deletion_root_category_id)))
    }).catch(() => {
      if (active.current && current === request.current) setError("Unable to load Trash. Please try again.")
    }).finally(() => {
      if (active.current && current === request.current) setLoading(false)
    })
  }, [siteId])

  useEffect(() => {
    active.current = true
    void load()
    return () => { active.current = false }
  }, [load])

  const restore = async (item: TrashItem) => {
    if (busy.current) return
    busy.current = true
    setRestoring(`${item.kind}:${item.id}`)
    setError(null)
    try {
      const result = await (item.kind === "category" ? restoreRecordCategory(item.id) : restoreRecord(item.id))
      if (!active.current) return
      if (result.error || !result.success) {
        setError(result.error || "Unable to restore this item")
        return
      }
      onRestored()
      setLoading(true)
      await load()
    } catch {
      if (active.current) setError("Unable to restore this item. Please try again.")
    } finally {
      busy.current = false
      if (active.current) setRestoring(null)
    }
  }

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Records Trash</DialogTitle>
          <DialogDescription>
            Restore deleted records and collections. Restoring a collection restores its records and
            subcategories deleted with it. Items already in Trash before that deletion stay in Trash.
            Restore a deleted parent collection before restoring an individual item within it.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {loading ? <p role="status">Loading Trash...</p> : (
          <>
            {!error && items.length === 0 && <p>Trash is empty.</p>}
            <ul className="max-h-96 overflow-y-auto space-y-3" aria-label="Deleted items">
              {items.map(item => (
                <li key={`${item.kind}:${item.id}`} className="flex items-center justify-between gap-4 border-b pb-3">
                  <div className="min-w-0">
                    <p className="break-words font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.kind === "category" ? "Collection" : "Record"} · Deleted {new Date(item.deleted_at).toLocaleString()}
                    </p>
                  </div>
                  <Button variant="outline" disabled={!!restoring} aria-label={`Restore ${item.title}`} onClick={() => void restore(item)}>
                    {restoring === `${item.kind}:${item.id}` ? "Restoring..." : "Restore"}
                  </Button>
                </li>
              ))}
            </ul>
            {error && <Button variant="outline" disabled={!!restoring} onClick={() => {
              setLoading(true)
              setError(null)
              void load()
            }}>Reload Trash</Button>}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}