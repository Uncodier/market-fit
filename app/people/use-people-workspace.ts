import type { PeoplePageState } from "./use-people-page-state"
import type { createFinderQuery } from "./finder-api"
import type { useFinderSearch } from "./use-finder-search"
import { usePeopleFilters } from "./use-people-filters"
import { usePeopleSavedListActions } from "./use-people-saved-list-actions"
import { usePeopleResultGroups } from "./use-people-result-groups"
import { usePeopleLeadActions } from "./use-people-lead-actions"

export function usePeopleWorkspace(state: PeopleSearchState, createQuery: typeof createFinderQuery) {
  const filters = usePeopleFilters(state.currentSite)
  const dependencies = { ...state, ...filters }
  const savedLists = usePeopleSavedListActions(dependencies)
  const groups = usePeopleResultGroups(state)
  const leads = usePeopleLeadActions({ ...dependencies, ...groups, createQuery })
  const {
    buildFinderPayload,
    executeSearch,
    isSearchPending,
    setCurrentPage,
    setShowResultsOnMobile,
  } = dependencies
  const handleSearch = async (page: number = 1) => {
    const payload = buildFinderPayload(page)
    await executeSearch(payload)
  }
  const onClickSearch = () => {
    if (isSearchPending()) return
    setCurrentPage(1)
    handleSearch(1)
    setShowResultsOnMobile(true)
  }

  const onPageChange = (page: number) => {
    if (isSearchPending()) return
    setCurrentPage(page)
    handleSearch(page)
  }
  const isEmptyView = !state.loading && state.totalResults === 0
  return { ...dependencies, ...savedLists, ...groups, ...leads, handleSearch, onClickSearch, onPageChange, isEmptyView }
}
export type PeopleSearchState = PeoplePageState & ReturnType<typeof useFinderSearch>
export type PeopleWorkspace = ReturnType<typeof usePeopleWorkspace>
