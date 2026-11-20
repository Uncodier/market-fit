"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import { createFinderQuery } from "./finder-api"
import { useFinderSearch } from "./use-finder-search"
import { usePeoplePageState } from "./use-people-page-state"
import { usePeopleWorkspace } from "./use-people-workspace"
import { PeopleSidebar } from "./people-sidebar"
import { PeopleResultsView } from "./people-results-view"
import { PeopleActionDialogs } from "./people-action-dialogs"
import { useSite } from "@/app/context/SiteContext"
import { useFinderSessionScope, type FinderScopeCheck } from "./use-finder-session-scope"

export default function PeopleSearchPage() {
  const { currentSite } = useSite()
  const { generation, isSessionCurrent } = useFinderSessionScope()
  const [peopleTab, setPeopleTab] = useState<"search" | "saved">("search")
  return <PeopleSearchWorkspace key={`${currentSite?.id ?? ''}:${generation}`} isSessionCurrent={isSessionCurrent}
    peopleTab={peopleTab} setPeopleTab={setPeopleTab} />
}

function PeopleSearchWorkspace({ isSessionCurrent, peopleTab, setPeopleTab }: {
  isSessionCurrent: FinderScopeCheck
  peopleTab: "search" | "saved"
  setPeopleTab: Dispatch<SetStateAction<"search" | "saved">>
}) {
  const state = usePeoplePageState(peopleTab, setPeopleTab)
  const search = useFinderSearch({
    siteId: state.currentSite?.id,
    onResults: (results, total) => {
      state.setError(null)
      state.setSearchResults(results)
      state.setTotalResults(total)
    },
  })
  const createQuery = async (payload: unknown) => await createFinderQuery(payload)
  const workspace = usePeopleWorkspace({ ...state, ...search }, createQuery, isSessionCurrent)

  return (
    <div className="flex h-full relative">
      <PeopleSidebar workspace={workspace} />
      <PeopleResultsView workspace={workspace} />
      <PeopleActionDialogs workspace={workspace} />
    </div>
  )
}
