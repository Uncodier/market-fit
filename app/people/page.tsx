"use client"

import { createFinderQuery } from "./finder-api"
import { useFinderSearch } from "./use-finder-search"
import { usePeoplePageState } from "./use-people-page-state"
import { usePeopleWorkspace } from "./use-people-workspace"
import { PeopleSidebar } from "./people-sidebar"
import { PeopleResultsView } from "./people-results-view"
import { PeopleActionDialogs } from "./people-action-dialogs"

export default function PeopleSearchPage() {
  const state = usePeoplePageState()
  const search = useFinderSearch({
    siteId: state.currentSite?.id,
    onResults: (results, total) => {
      state.setError(null)
      state.setSearchResults(results)
      state.setTotalResults(total)
    },
  })
  const createQuery = async (payload: unknown) => await createFinderQuery(payload)
  const workspace = usePeopleWorkspace({ ...state, ...search }, createQuery)

  return (
    <div className="flex h-full relative">
      <PeopleSidebar workspace={workspace} />
      <PeopleResultsView workspace={workspace} />
      <PeopleActionDialogs workspace={workspace} />
    </div>
  )
}
