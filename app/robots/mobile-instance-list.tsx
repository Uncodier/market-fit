"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/app/components/ui/button"
import { SearchInput } from "@/app/components/ui/search-input"
import { Skeleton } from "@/app/components/ui/skeleton"
import { ChevronRight, Plus } from "@/app/components/ui/icons"
import { useRobots } from "@/app/context/RobotsContext"
import { getInstanceStatusLabel, normalizeSearch } from "@/app/components/robots/instance-browser-model"
import { sortRobotInstances } from "@/lib/navigation/robots-instance"
import type { useWorkspaceTabs } from "./use-workspace-tabs"
import styles from "./mobile-instance-screens.module.css"

type Props = Pick<ReturnType<typeof useWorkspaceTabs>,
  "tabInstances" | "instanceAvatars" | "isLoadingRobots" | "t" |
  "handleCreateNewInstance" | "refreshRobots" | "currentSite">
  & { onSelect: (id: string) => void }

export function MobileInstanceList({ tabInstances, instanceAvatars, isLoadingRobots,
  t, handleCreateNewInstance, refreshRobots, currentSite, onSelect }: Props) {
  const { error } = useRobots()
  const [search, setSearch] = useState("")
  const [creating, setCreating] = useState(false)
  const [creationError, setCreationError] = useState(false)
  const instances = sortRobotInstances(tabInstances).filter((instance) =>
    normalizeSearch(instance.requirement_title || instance.name || instance.id).includes(normalizeSearch(search)))

  async function createInstance() {
    if (creating) return
    setCreating(true)
    setCreationError(false)
    try { await handleCreateNewInstance() } catch { setCreationError(true) } finally { setCreating(false) }
  }

  return (
    <section aria-label="Instances" className={`${styles.list} absolute inset-x-0 bottom-0 top-[var(--topbar-height,64px)] flex min-h-0 flex-col bg-background md:hidden`}>
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
        <h2 className="sr-only">Instances</h2>
        <SearchInput value={search} onChange={(event) => setSearch(event.target.value)}
          placeholder={t("robots.browser.search")} alwaysExpanded containerClassName="min-w-0 flex-1" />
        <Button variant="secondary" size="icon" className="shrink-0 rounded-full" aria-label="Create new agent"
          disabled={creating || !currentSite} onClick={createInstance}><Plus size={20} /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(100px+env(safe-area-inset-bottom,0px))]">
        {creationError && <p role="alert" className="p-4 text-sm text-destructive">Could not create an instance. Please try again.</p>}
        {error ? (
          <div role="alert" className="space-y-3 p-6 text-sm">
            <p>Could not load instances.</p>
            <Button variant="outline" onClick={() => void refreshRobots(currentSite?.id)}>Try again</Button>
          </div>
        ) : isLoadingRobots && !tabInstances.length ? (
          <div role="status" aria-label="Loading instances" className="space-y-4 p-4">
            {[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : !instances.length ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("robots.browser.empty")}</div>
        ) : (
          <ul className="divide-y divide-border/40">
            {instances.map((instance) => {
              const name = instance.requirement_title || instance.name || `ag-${instance.id.slice(-4)}`
              const avatar = instanceAvatars[instance.id]
              return (
                <li key={instance.id}>
                  <button type="button" onClick={() => onSelect(instance.id)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-lg font-medium text-accent-foreground" aria-hidden="true">
                      {avatar ? <Image src={avatar} alt="" width={48} height={48} className="h-full w-full object-cover" /> : name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{getInstanceStatusLabel(instance.status)}</span>
                    </span>
                    <ChevronRight size={18} className="text-muted-foreground" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}