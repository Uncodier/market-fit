import { useState } from "react"
import { toast } from "sonner"
import { deleteRecord, updateRecord, type RecordItem } from "../actions"

export function useRecordsBulkActions(records: RecordItem[], refreshData: () => void) {
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set())
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false)

  const updateLoadedRecord = async (id: string, updates: { status?: string; category_id?: string }) => {
    const record = records.find(item => item.id === id)
    if (!record?.updated_at) throw new Error("Record version unavailable. Reload before editing.")
    return updateRecord(id, updates, record.updated_at)
  }

  const run = async (operation: (id: string) => Promise<{ success?: boolean; error?: string }>, message: string) => {
    if (isBulkActionLoading) return
    setIsBulkActionLoading(true)
    const ids = Array.from(selectedRecords)
    try {
      const results = await Promise.allSettled(ids.map(operation))
      const failed = new Set<string>()
      const errors = new Set<string>()
      results.forEach((result, index) => {
        if (result.status === "rejected" || result.value.error) {
          failed.add(ids[index])
          errors.add(result.status === "rejected"
            ? (result.reason instanceof Error ? result.reason.message : "Request failed")
            : result.value.error!)
        }
      })
      setSelectedRecords(failed)
      if (failed.size) toast.error(`${failed.size} record(s) could not be changed. ${Array.from(errors).join(" ")}`)
      else toast.success(message)
      refreshData()
    } finally {
      setIsBulkActionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Move ${selectedRecords.size} selected records to Trash? You can restore them from Trash.`)) return
    await run(deleteRecord, "Selected records moved to Trash")
  }

  return {
    selectedRecords, setSelectedRecords, isBulkActionLoading, handleBulkDelete, updateLoadedRecord,
    handleBulkStatusChange: (status: string) => run(id => updateLoadedRecord(id, { status }), "Record statuses updated"),
    handleBulkCategoryChange: (category_id: string) => run(id => updateLoadedRecord(id, { category_id }), "Record categories updated"),
  }
}