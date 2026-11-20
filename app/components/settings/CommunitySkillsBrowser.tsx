"use client"

import { useEffect, useState } from "react"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { GitFork, Star } from "@/app/components/ui/icons"
import {
  SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader,
} from "@/app/components/ui/section-card"
import { getSkillResponseField, skillRequest } from "./skill-client"
import { SkillsSearch } from "./SkillsSearch"
import { SkillsLoading } from "./skills-loading"

type CommunitySkill = {
  name: string; description?: string; url: string; repository?: string; stars?: number; forks?: number
}

const DISCOVERY_QUERY = "skills"
type SearchOutcome = { results: CommunitySkill[] } | { error: string }

export function CommunitySkillsBrowser({ searchTarget = null, onImport }: {
  searchTarget?: HTMLElement | null
  onImport: (url: string) => void
}) {
  const { currentSite } = useSite()
  const siteId = currentSite?.id
  const [query, setQuery] = useState("")
  const [request, setRequest] = useState({ query: "" })
  const [response, setResponse] = useState<{ siteId: string; request: typeof request; outcome: SearchOutcome }>()
  const outcome = response && response.siteId === siteId && response.request === request ? response.outcome : undefined
  const error = outcome && "error" in outcome ? outcome.error : undefined
  const results = outcome && "results" in outcome ? outcome.results : undefined
  const pending = Boolean(siteId && !outcome)

  useEffect(() => {
    if (!siteId) return
    let active = true
    const value = request.query || DISCOVERY_QUERY
    skillRequest(`/api/skills/external?site_id=${encodeURIComponent(siteId)}&query=${encodeURIComponent(value)}`)
      .then(result => {
        if (!active) return
        const entries = getSkillResponseField(result, "results")
        if (!Array.isArray(entries)) throw new Error("Invalid community skills response")
        const results = entries.filter((entry: CommunitySkill) =>
          entry && typeof entry.url === "string" && typeof entry.name === "string")
        setResponse({ siteId, request, outcome: { results } })
      })
      .catch(error => {
        if (active) setResponse({ siteId, request, outcome: { error: error instanceof Error ? error.message : "Skill request failed" } })
      })
    return () => { active = false }
  }, [siteId, request])

  return (
    <div className="space-y-6" aria-label="Browse community skills">
      <section id="community-skills" className="scroll-mt-40 space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Browse community skills</h2>
          <p className="text-sm text-muted-foreground">Press Enter to search public GitHub skills. Review their instructions before adding them: community instructions are untrusted.</p>
        </div>
      </section>
      <SkillsSearch target={searchTarget} label="Search community skills" value={query} onChange={value => {
        setQuery(value)
        if (!value && request.query) setRequest({ query: "" })
      }}
        onSubmit={value => setRequest({ query: value })} disabled={!siteId} maxLength={100} />
      {error && <div className="space-y-2">
        <p role="alert" className="text-sm text-destructive">Could not load community skills: {error}</p>
        <Button variant="outline" size="sm" onClick={() => setRequest({ query: request.query })}>Retry</Button>
      </div>}

      <section id="community-results" className="scroll-mt-40 space-y-4" aria-label="Community search results" hidden={!pending && !results}>
        {pending && <SkillsLoading kind="community" />}
        {results && <h2 className="text-lg font-semibold">{request.query ? "Search results" : "Discover community skills"}</h2>}
        {results?.length === 0 && <p className="text-sm text-muted-foreground">
          {request.query ? "No community skills found for this search." : "No community skills found. Try searching by name or topic."}
        </p>}
        {results?.map((skill, index) => {
          const stars = typeof skill.stars === "number" && Number.isSafeInteger(skill.stars) && skill.stars >= 0 ? skill.stars : null
          const forks = typeof skill.forks === "number" && Number.isSafeInteger(skill.forks) && skill.forks >= 0 ? skill.forks : null
          return (
            <SectionCard key={skill.url}>
              <SectionCardHeader title={
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>{index + 1}. {skill.name}</span>
                  {(stars !== null || forks !== null) && (
                    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-normal text-muted-foreground" aria-label="Repository popularity">
                      {stars !== null && <span className="inline-flex items-center gap-1"><Star size={14} />{stars.toLocaleString("en-US")} stars</span>}
                      {forks !== null && <span className="inline-flex items-center gap-1"><GitFork size={14} />{forks.toLocaleString("en-US")} forks</span>}
                    </span>
                  )}
                </span>
              } description={skill.repository} />
              {skill.description && (
                <SectionCardContent>
                  <p className="text-sm text-muted-foreground">{skill.description}</p>
                </SectionCardContent>
              )}
              <SectionCardFooter>
                <Button variant="outline" disabled={pending || !siteId} onClick={() => onImport(skill.url)}>Review and import</Button>
              </SectionCardFooter>
            </SectionCard>
          )
        })}
      </section>

    </div>
  )
}
