import { format } from "date-fns"
import type { RecordItem } from "../actions"
import { recordStatusGroup, recordStatusGroups } from "./record-status"

export type RecordGrouping = "status" | "category" | "date" | "team_member"

export function groupTableRecords(records: RecordItem[], groupBy: RecordGrouping) {
  const groups: Record<string, RecordItem[]> = Object.create(null)

  records.forEach((record) => {
    let key = "unknown"
    if (groupBy === "status") {
      key = recordStatusGroup(record.status)
    } else if (groupBy === "category") {
      key = record.category_id || "uncategorized"
    } else if (groupBy === "date") {
      if (record.created_at) {
        key = format(new Date(record.created_at), "yyyy-MM")
      } else {
        key = "unknown_date"
      }
    } else if (groupBy === "team_member") {
      let memberId = "unassigned"
      if (record.category?.template_fields) {
        const teamMemberField = record.category.template_fields.find(f => f.relationTarget === 'team_member')
        if (teamMemberField && record.relations?.[teamMemberField.name]) {
          memberId = record.relations[teamMemberField.name]
        }
      }
      key = memberId
    }

    if (!groups[key]) groups[key] = []
    groups[key].push(record)
  })

  let keys = Object.keys(groups)
  if (groupBy === "status") {
    keys = recordStatusGroups(records).filter(status => groups[status])
  } else if (groupBy === "date") {
    keys = keys.sort((a, b) => b.localeCompare(a)) // sort descending
  } else if (groupBy === "category" || groupBy === "team_member") {
    keys = keys.sort()
  }

  return { groupedRecords: groups, groupKeys: keys }
}

export function getTableRecordOrder(records: RecordItem[], groupBy: RecordGrouping, itemsPerPage: number) {
  if (!Number.isInteger(itemsPerPage) || itemsPerPage < 1) return []
  const ids: string[] = []
  for (let start = 0; start < records.length; start += itemsPerPage) {
    // The table groups each page independently after pagination.
    const { groupedRecords, groupKeys } = groupTableRecords(records.slice(start, start + itemsPerPage), groupBy)
    for (const key of groupKeys) ids.push(...groupedRecords[key].map(record => record.id))
  }
  return ids
}
