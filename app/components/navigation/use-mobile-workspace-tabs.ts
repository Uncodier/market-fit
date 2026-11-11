"use client"

import { useEffect, useReducer } from "react"
import {
  defaultMobileWorkspaceTabs,
  mobileTabsFromShortcuts,
  updateMobileWorkspaceTabs,
  type MobileWorkspaceTab,
} from "./mobile-workspace-tabs"
import {
  loadShortcuts,
  loadShortcutsFromLocalStorage,
  SHORTCUTS_UPDATED_EVENT,
  type ShortcutsUpdatedDetail,
} from "./shortcut-storage"

interface State {
  scope: string
  tabs: MobileWorkspaceTab[]
  visits: MobileWorkspaceTab[]
}
type Action =
  | { type: "visit"; scope: string; active: MobileWorkspaceTab | null }
  | { type: "hydrate"; scope: string; tabs: MobileWorkspaceTab[] }

const emptyTabs: MobileWorkspaceTab[] = []

function reducer(previous: State, action: Action): State {
  const state = previous.scope === action.scope ? previous : {
    scope: action.scope, tabs: defaultMobileWorkspaceTabs(), visits: emptyTabs,
  }
  if (action.type === "hydrate") {
    return { ...state, tabs: state.visits.reduce(updateMobileWorkspaceTabs, action.tabs) }
  }
  const tabs = updateMobileWorkspaceTabs(state.tabs, action.active)
  const visits = updateMobileWorkspaceTabs(state.visits, action.active)
  return tabs === state.tabs && visits === state.visits ? state : { ...state, tabs, visits }
}

export function useMobileWorkspaceTabs(
  userId: string | undefined,
  siteId: string | undefined,
  active: MobileWorkspaceTab | null,
) {
  const scope = userId && siteId ? `${userId}:${siteId}` : ""
  const [state, dispatch] = useReducer(reducer, { scope: "", tabs: emptyTabs, visits: emptyTabs })
  const activeKey = active?.key
  const activeHref = active?.href

  useEffect(() => {
    dispatch({ type: "visit", scope, active: scope ? active : null })
  }, [scope, activeKey, activeHref, active])

  useEffect(() => {
    if (!scope || !siteId) return
    let cancelled = false
    let revision = 0
    const publish = (tabs: MobileWorkspaceTab[]) => {
      if (!cancelled) dispatch({ type: "hydrate", scope, tabs })
    }
    void loadShortcuts(userId, siteId).then((entries) => {
      if (revision === 0) publish(mobileTabsFromShortcuts(entries))
    }).catch(() => {
      if (revision === 0) publish(defaultMobileWorkspaceTabs())
    })
    const sync = (event: Event) => {
      const eventSite = (event as CustomEvent<ShortcutsUpdatedDetail>).detail?.siteId
      if (eventSite && eventSite !== siteId) return
      revision += 1
      try {
        publish(mobileTabsFromShortcuts(loadShortcutsFromLocalStorage(siteId)))
      } catch {
        // Keep the current tabs when browser storage is unavailable.
      }
    }
    window.addEventListener(SHORTCUTS_UPDATED_EVENT, sync)
    return () => {
      cancelled = true
      window.removeEventListener(SHORTCUTS_UPDATED_EVENT, sync)
    }
  }, [scope, userId, siteId])

  if (!scope) return emptyTabs
  return updateMobileWorkspaceTabs(
    state.scope === scope ? state.tabs : defaultMobileWorkspaceTabs(), active,
  )
}