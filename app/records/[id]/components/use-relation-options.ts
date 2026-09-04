import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { RelationSelectOption } from "@/app/components/ui/relation-select"
import {
  getRelationTargetConfig,
  keepSelectedRelationOptions,
  relationOptionSearchText,
  uniqueRelationTargets,
} from "./relation-target"

const SEARCH_LIMIT = 20
const SEARCH_DEBOUNCE_MS = 300

function mapRowsToOptions(
  rows: Array<Record<string, unknown>>,
  nameField: string,
): RelationSelectOption[] {
  return rows.map((item) => ({
    id: String(item.id),
    label: String(item[nameField] || item.id),
    searchText: relationOptionSearchText(item, nameField),
  }))
}

export function useRelationOptions(
  fields: Array<{ type?: string; relationTarget?: string }>,
  siteId: string | undefined,
  selectedIds: string[],
) {
  const [relationOptions, setRelationOptions] = useState<Record<string, RelationSelectOption[]>>({})
  const searchTimeouts = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const activeSearchRef = useRef<Record<string, string>>({})
  const requestIdRef = useRef<Record<string, number>>({})
  const selectedKey = selectedIds.slice().sort().join(",")
  const selectedIdSet = useMemo(() => new Set(selectedKey ? selectedKey.split(",") : []), [selectedKey])

  const loadOptions = useCallback(async (target: string, query: string) => {
    if (!siteId) return

    const config = getRelationTargetConfig(target)
    const requestId = (requestIdRef.current[target] || 0) + 1
    requestIdRef.current[target] = requestId

    const supabase = createClient()
    let request = supabase
      .from(config.table)
      .select(config.selectFields)
      .eq("site_id", siteId)
      .limit(SEARCH_LIMIT)

    const trimmed = query.trim()
    if (trimmed.length >= 2) {
      request = request.ilike(config.nameField, `%${trimmed}%`)
    }

    const { data, error } = await request
    if (requestIdRef.current[target] !== requestId) return
    if (error) {
      console.error(`Error fetching options for ${target}:`, error)
      return
    }

    const incoming = mapRowsToOptions((data || []) as Array<Record<string, unknown>>, config.nameField)
    setRelationOptions((prev) => ({
      ...prev,
      [target]: keepSelectedRelationOptions(incoming, prev[target] || [], selectedIdSet),
    }))
  }, [selectedIdSet, siteId])

  const targets = useMemo(() => uniqueRelationTargets(fields), [fields])

  useEffect(() => {
    if (!siteId || targets.length === 0) return
    for (const target of targets) {
      if (activeSearchRef.current[target]) continue
      void loadOptions(target, "")
    }
  }, [loadOptions, siteId, targets])

  const handleSearchChange = useCallback((target: string, query: string) => {
    if (!siteId) return

    if (searchTimeouts.current[target]) {
      clearTimeout(searchTimeouts.current[target])
    }

    const trimmed = query.trim()
    activeSearchRef.current[target] = trimmed
    if (trimmed.length === 1) return

    searchTimeouts.current[target] = setTimeout(() => {
      void loadOptions(target, trimmed)
    }, SEARCH_DEBOUNCE_MS)
  }, [loadOptions, siteId])

  return { relationOptions, setRelationOptions, handleSearchChange }
}
