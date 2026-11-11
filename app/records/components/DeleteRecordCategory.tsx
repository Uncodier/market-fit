import { useRef, useState } from "react"
import { deleteRecordCategory, type RecordCategory } from "../actions"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"

export function DeleteRecordCategory({ category, disabled, onDeleted }: {
  category: RecordCategory
  disabled: boolean
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const remove = async () => {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError(null)
    try {
      const result = await deleteRecordCategory(category.id)
      if (result.error || !result.success) {
        setError(result.error || "Unable to move collection to Trash")
        return
      }
      setOpen(false)
      onDeleted()
    } catch {
      setError("Unable to move collection to Trash. Please try again.")
    } finally {
      busy.current = false
      setPending(false)
    }
  }
  return <>
    <Button variant="destructive" disabled={disabled} onClick={() => { setError(null); setOpen(true) }}>Delete collection</Button>
    <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move collection to Trash?</DialogTitle>
          <DialogDescription>
            This moves the entire collection “{category.name}”, all its records and all subcategories
            to Trash, including records hidden by your current filters. Nothing is permanently deleted.
            You can restore the collection from Trash. Items already in Trash will not be restored with it.
          </DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={pending} onClick={() => void remove()}>{pending ? "Moving..." : "Move collection to Trash"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}