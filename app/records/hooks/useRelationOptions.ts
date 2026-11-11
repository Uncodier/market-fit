import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RelationSelectOption } from "@/app/components/ui/relation-select"
import { siteMembersService } from "@/app/services/site-members-service"
import { assignableSiteMembers } from "@/lib/auth/assignable-site-members"
import { getSiteCompanyIds } from "../lib/relation-query"
import {
  getRelationTargetConfig, parseRelationTargetKey, relationOptionSearchText,
  uniqueRelationTargets, type RelationFieldTarget,
} from "../lib/relation-target"

type Options = Record<string, RelationSelectOption[]>
const SEARCH_LIMIT = 20

export function useRelationOptions(fields: RelationFieldTarget[], siteId: string | undefined, selectedIds: string[]) {
  const targetKey = uniqueRelationTargets(fields).sort().join(",")
  const targets = useMemo(() => targetKey ? targetKey.split(",") : [], [targetKey])
  const scope = `${siteId || ""}|${targetKey}`
  const activeScope = useRef(scope)
  activeScope.current = scope
  const [state, setState] = useState<{ scope: string; options: Options }>({ scope, options: {} })
  const [errors, setErrors] = useState<{ scope: string; values: Record<string, string> }>({ scope, values: {} })
  const requestIds = useRef<Record<string, number>>({})
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const searches = useRef<Record<string, string>>({})
  const selectedKey = [...new Set(selectedIds.filter(id => id.trim()))].sort().join(",")
  const selected = useMemo(() => selectedKey ? selectedKey.split(",") : [], [selectedKey])
  const activeSelected = useRef(selected)
  activeSelected.current = selected

  const loadOptions = useCallback(async (key: string, search: string) => {
    if (!siteId || !targets.includes(key)) return
    const requestKey = `${scope}|${key}`
    const requestId = (requestIds.current[requestKey] || 0) + 1
    requestIds.current[requestKey] = requestId
    const current = () => activeScope.current === scope && requestIds.current[requestKey] === requestId
    const save = (options: RelationSelectOption[]) => {
      if (!current()) return
      setState(prev => ({ scope, options: { ...(prev.scope === scope ? prev.options : {}), [key]: options } }))
    }
    try {
      const { target, categoryId } = parseRelationTargetKey(key)
      const config = getRelationTargetConfig(target)
      if (!config) throw new Error("This relation target is unavailable. Review the category template.")
      const queryText = search.trim()
      if (target === "team_member") {
        const members = assignableSiteMembers(await siteMembersService.getMembers(siteId))
        save(members.map(member => ({ id: member.user_id, label: member.name || member.email,
          searchText: `${member.name || ""} ${member.email}`,
        })).filter(option => !queryText || option.searchText.toLowerCase().includes(queryText.toLowerCase())))
      } else {
        const supabase = createClient()
        const companies = target === "company" ? await getSiteCompanyIds(supabase, siteId) : null
        if (!current()) return
        const buildQuery = () => {
          let query = supabase.from(config.table).select(config.selectFields)
          query = companies ? query.in("id", companies) : query.eq("site_id", siteId)
          if (target === "record" || target === "record_category") query = query.is("deleted_at", null)
          if (categoryId) query = query.eq("category_id", categoryId)
          return query
        }
        if (companies?.length === 0) {
          save([])
        } else {
          let query = buildQuery().order(config.idField).limit(SEARCH_LIMIT)
          if (queryText) query = query.ilike(config.nameField, `%${queryText.replace(/[%_\\]/g, "\\$&")}%`)
          const { data, error } = await query
          if (error) throw new Error("Unable to load relation options")
          let rows = (data || []) as unknown as Array<Record<string, unknown>>
          // Re-read selected IDs under the same boundary; never revive cached options.
          if (activeSelected.current.length && !queryText) {
            const { data: retained, error: retainedError } = await buildQuery().in(config.idField, activeSelected.current.slice(0, 200))
            if (retainedError) throw new Error("Unable to verify selected relations")
            rows = [...rows, ...(retained || []) as unknown as Array<Record<string, unknown>>]
          }
          const options = new Map(rows.map(row => [String(row[config.idField]), {
            id: String(row[config.idField]), label: String(row[config.nameField] || "Unnamed"),
            searchText: relationOptionSearchText(row, config.nameField),
          }]))
          save([...options.values()])
        }
      }
      if (current()) setErrors(prev => ({ scope, values: { ...(prev.scope === scope ? prev.values : {}), [key]: "" } }))
    } catch (error) {
      save([])
      if (current()) setErrors(prev => ({ scope, values: { ...(prev.scope === scope ? prev.values : {}),
        [key]: error instanceof Error ? error.message : "Unable to load relation options",
      } }))
    }
  }, [scope, siteId, targets])

  useEffect(() => {
    searches.current = {}
    for (const key of targets) void loadOptions(key, "")
    const pending = timers.current
    const requests = requestIds.current
    return () => {
      for (const timer of Object.values(pending)) clearTimeout(timer)
      for (const key of targets) {
        const requestKey = `${scope}|${key}`
        requests[requestKey] = (requests[requestKey] || 0) + 1
      }
    }
  }, [loadOptions, scope, targets])

  const previousSelection = useRef({ scope, selectedKey })
  useEffect(() => {
    const previous = previousSelection.current
    previousSelection.current = { scope, selectedKey }
    if (previous.scope !== scope || previous.selectedKey === selectedKey) return
    // Selection hydration must not replace another target's active or pending search.
    for (const key of targets) {
      if (!searches.current[key]?.trim()) void loadOptions(key, "")
    }
  }, [loadOptions, scope, selectedKey, targets])

  const handleSearchChange = useCallback((key: string, query: string) => {
    if (!siteId || !targets.includes(key)) return
    searches.current[key] = query
    clearTimeout(timers.current[key])
    const requestKey = `${scope}|${key}`
    requestIds.current[requestKey] = (requestIds.current[requestKey] || 0) + 1
    timers.current[key] = setTimeout(() => void loadOptions(key, query), 300)
  }, [loadOptions, scope, siteId, targets])

  return {
    relationOptions: state.scope === scope ? state.options : {},
    relationErrors: errors.scope === scope ? errors.values : {},
    handleSearchChange,
  }
}