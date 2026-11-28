import { useEffect, useState } from "react"
import { useUserData } from "@/app/hooks/use-user-data"
import { resolveRelationsForSidebar, type RecordItem } from "../actions"
import { fetchPreviewBatches } from "../lib/entity-preview-request"

const noLabels: Record<string, string> = {}

export function recordMemberIds(record: RecordItem): string[] {
  const ids = (record.category?.template_fields ?? [])
    .filter(field => field.type === "relation" && field.relationTarget === "team_member")
    .map(field => record.relations?.[field.name])
    .filter((id): id is string => typeof id === "string" && Boolean(id.trim()))
  return [...new Set(ids)]
}

export function useRecordCardMembers(records: RecordItem[], siteId: string | undefined) {
  const idsKey = JSON.stringify([...new Set(records.flatMap(record => record.site_id === siteId ? recordMemberIds(record) : []))].sort())
  const scope = JSON.stringify([siteId, idsKey])
  const [snapshot, setSnapshot] = useState<{ scope: string; labels: Record<string, string> }>()
  useEffect(() => {
    if (!siteId || idsKey === "[]") return
    let active = true
    const ids: string[] = JSON.parse(idsKey)
    void fetchPreviewBatches([{ target: "team_member", ids }], siteId, resolveRelationsForSidebar).then(result => {
      if (!active) return
      setSnapshot({ scope, labels: Object.fromEntries(ids.flatMap(id => {
        const label = result[`team_member:${id}`]
        return label ? [[id, label]] : []
      })) })
    }).catch(() => { if (active) setSnapshot({ scope, labels: {} }) })
    return () => { active = false }
  }, [idsKey, scope, siteId])
  const labels = snapshot?.scope === scope ? snapshot.labels : noLabels
  const { userData } = useUserData(Object.keys(labels), siteId)
  return { labels, profiles: userData, siteId }
}

export type RecordCardMembers = ReturnType<typeof useRecordCardMembers>