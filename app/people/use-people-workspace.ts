import { useLayoutEffect, useRef, useState } from "react"
import type { PeoplePageState } from "./use-people-page-state"
import type { createFinderQuery } from "./finder-api"
import type { useFinderSearch } from "./use-finder-search"
import { usePeopleFilters } from "./use-people-filters"
import { usePeopleSavedListActions } from "./use-people-saved-list-actions"
import { usePeopleResultGroups } from "./use-people-result-groups"
import { usePeopleLeadActions } from "./use-people-lead-actions"
import { useSelectedListActions } from "./use-selected-list-actions"
import { usePeopleSelectionEnrichment } from "./use-people-selection-enrichment"
import type { FinderScopeCheck } from "./use-finder-session-scope"
import type { FinderRequest } from "./finder-request-types"

export function usePeopleWorkspace(state: PeopleSearchState, createQuery: typeof createFinderQuery, isSessionCurrent: FinderScopeCheck) {
  const filters = usePeopleFilters(state.currentSite)
  const mounted = useRef(false)
  const resultRevision = useRef(0)
  const [activeSavedQuery, setActiveSavedQuery] = useState<FinderRequest | null>(null)
  useLayoutEffect(() => {
    resultRevision.current++
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const captureResultScope = (): FinderScopeCheck => {
    const revision = resultRevision.current
    return requestActor => mounted.current && isSessionCurrent(requestActor) && resultRevision.current === revision
  }
  const selectionLists = useSelectedListActions({ siteId: state.currentSite?.id,
    selectedPersonIds: state.selectedPersonIds, setSelectedPersonIds: state.setSelectedPersonIds,
    refreshIcps: state.refreshIcps, captureResultScope })
  const resetResultSelection = () => {
    resultRevision.current++
    state.setSelectedPersonIds([])
    state.setIsConfirmModalOpen(false)
    selectionLists.dismiss()
  }
  const dependencies = { ...state, ...filters, captureResultScope, resetResultSelection }
  const savedLists = usePeopleSavedListActions(dependencies)
  const groups = usePeopleResultGroups(state)
  const leads = usePeopleLeadActions({ ...dependencies, ...groups, createQuery })
  const enrichment = usePeopleSelectionEnrichment(dependencies)
  const {
    buildFinderPayload,
    executeSearch,
    isSearchPending,
    setCurrentPage,
    setShowResultsOnMobile,
  } = dependencies
  const handleSearch = async (page: number = 1) => {
    if (!isSessionCurrent()) return
    resetResultSelection()
    state.setSelectedList(null)
    const payload = buildFinderPayload(page)
    await executeSearch(payload)
  }
  const runSavedSearch = () => {
    const list = state.selectedList
    if (!list?.query || list.siteId !== state.currentSite?.id || isSearchPending() || !isSessionCurrent()) return
    resetResultSelection()
    state.setSelectedList(null)
    setActiveSavedQuery(list.query)
    setCurrentPage(1)
    state.setPeopleTab('search')
    setShowResultsOnMobile(true)
    const payload = { ...list.query, site_id: list.siteId, page: 0 }
    void executeSearch(payload)
  }
  const onClickSearch = () => {
    if (isSearchPending()) return
    setActiveSavedQuery(null)
    setCurrentPage(1)
    handleSearch(1)
    setShowResultsOnMobile(true)
  }

  const onPageChange = (page: number) => {
    if (isSearchPending() || !isSessionCurrent()) return
    setCurrentPage(page)
    if (activeSavedQuery && state.currentSite?.id) {
      resetResultSelection()
      const payload = { ...activeSavedQuery, site_id: state.currentSite.id, page: page - 1 }
      void executeSearch(payload)
    } else void handleSearch(page)
  }
  const isEmptyView = !state.loading && state.totalResults === 0
  return { ...dependencies, ...savedLists, ...groups, ...leads, ...enrichment, selectionLists, handleSearch, runSavedSearch, onClickSearch, onPageChange, isEmptyView }
}
export type PeopleSearchState = PeoplePageState & ReturnType<typeof useFinderSearch>
export type PeopleWorkspace = ReturnType<typeof usePeopleWorkspace>
