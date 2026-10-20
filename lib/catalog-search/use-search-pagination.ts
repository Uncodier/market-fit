"use client"

import { useCallback, useEffect, useRef, useState } from "react"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function writeNavigation(page: number, searchId?: string) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  if (page > 1) url.searchParams.set("page", String(page))
  else url.searchParams.delete("page")
  if (searchId) url.searchParams.set("search_id", searchId)
  else url.searchParams.delete("search_id")
  window.history.replaceState(window.history.state, "", url)
}

/** Page transitions keep the immutable candidate snapshot; scope changes never reuse it. */
export function useSearchPagination(scope: string, searching: boolean, ready = true) {
  const [navigation, setNavigation] = useState(() => {
    const params = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)
    const id = params.get("search_id") || ""
    const page = Number(params.get("page"))
    return { scope, page: searching && UUID.test(id) && Number.isSafeInteger(page) && page > 0 ? page : 1,
      searchId: searching && UUID.test(id) ? id : undefined, generation: 0 }
  })
  // Catalog's selected site arrives after hydration; bind restored navigation once
  // it is ready, rather than treating that initial arrival as a tenant change.
  const activated = useRef(ready)
  const snapshot = useRef({ scope, id: navigation.searchId })
  const firstActivation = ready && !activated.current
  const changed = ready && activated.current && navigation.scope !== scope
  const page = changed ? 1 : navigation.page
  const searchId = changed ? undefined : snapshot.current.id
  if (firstActivation) {
    activated.current = true
    snapshot.current.scope = scope
    setNavigation(current => ({ ...current, scope }))
  }
  if (changed) {
    snapshot.current = { scope, id: undefined }
    setNavigation({ scope, page: 1, searchId: undefined, generation: navigation.generation + 1 })
  }
  useEffect(() => {
    if (ready) writeNavigation(page, searching ? snapshot.current.id : undefined)
  }, [scope, page, searching, ready, navigation.generation])

  const acceptSearchId = useCallback((id?: string) => {
    if (!searching || !id || !UUID.test(id) || snapshot.current.scope !== scope) return
    snapshot.current.id = id
    writeNavigation(page, id)
  }, [scope, searching, page])

  const setPage = useCallback((next: number) => {
    setNavigation(current => ({ ...current, scope, page: next, searchId: snapshot.current.id }))
    writeNavigation(next, searching ? snapshot.current.id : undefined)
  }, [scope, searching])

  const restart = useCallback(() => {
    snapshot.current = { scope, id: undefined }
    setNavigation(current => ({ scope, page: 1, searchId: undefined, generation: current.generation + 1 }))
    writeNavigation(1)
  }, [scope])

  return { page, setPage, searchId, acceptSearchId, restart, generation: navigation.generation }
}