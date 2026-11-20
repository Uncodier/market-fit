"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import type { QuickNavSection } from "@/app/components/ui/quick-nav"
import {
  SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader,
} from "@/app/components/ui/section-card"
import { skillRequest, skillsFromResponse, type ManagedSkill } from "./skill-client"
import { SkillsSearch } from "./SkillsSearch"
import { SkillsLoading } from "./skills-loading"

export function SystemSkillsCatalog({ onSectionsChange, searchTarget = null }: {
  onSectionsChange?: (sections: QuickNavSection[]) => void
  searchTarget?: HTMLElement | null
}) {
  const { currentSite } = useSite()
  const siteId = currentSite?.id
  const [loadedSkills, setSkills] = useState<ManagedSkill[] | null>(null)
  const [query, setQuery] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loading = Boolean(siteId && !loadedSkills && !error)

  useEffect(() => {
    if (!siteId) return
    let active = true
    skillRequest(`/api/skills/system?site_id=${encodeURIComponent(siteId)}`)
      .then(result => {
        if (active) setSkills(skillsFromResponse(result).filter(skill => skill.source === "system"))
      })
      .catch(err => {
        if (!active) return
        const message = err instanceof Error ? err.message : "Could not load Makinari skills"
        setError(message)
        toast.error(message)
      })
    return () => { active = false }
  }, [siteId])

  const visibleSkills = useMemo(() => (loadedSkills ?? []).filter(skill => `${skill.name} ${skill.slug} ${skill.description || ""}`
    .toLowerCase().includes(query.trim().toLowerCase())), [loadedSkills, query])
  const roleSkills = useMemo(() => visibleSkills.filter(skill => skill.slug.startsWith("makinari-rol-")), [visibleSkills])
  const otherSkills = useMemo(() => visibleSkills.filter(skill => !skill.slug.startsWith("makinari-rol-")), [visibleSkills])

  useEffect(() => {
    if (!onSectionsChange) return
    onSectionsChange([
      { id: "current-skills", title: "Current skills" },
      ...(roleSkills.length ? [{
        id: "current-skill-roles", title: "Roles", children: roleSkills.map(skill => ({
          id: `system-skill-${skill.slug}`, title: skill.slug.replace(/^makinari-rol-/, "").replace(/-/g, " "),
        })),
      }] : []),
      ...(otherSkills.length ? [{
        id: "current-skill-other", title: "Other skills", children: otherSkills.map(skill => ({
          id: `system-skill-${skill.slug}`, title: skill.name,
        })),
      }] : []),
    ])
  }, [onSectionsChange, roleSkills, otherSkills])

  return (
    <section id="current-skills" aria-label="Current Makinari skills" className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Current skills</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Built-in Makinari skills available to robots. Read their instructions below; they cannot be edited here.
        </p>
      </div>
      <SkillsSearch target={searchTarget} label="Search Makinari skills" value={query} onChange={setQuery}
        disabled={!siteId || loading} />
      {loading && <SkillsLoading kind="system" />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loading && !error && <p className="text-sm text-muted-foreground" role="status">
        {visibleSkills.length} {visibleSkills.length === 1 ? "skill" : "skills"}
      </p>}
      {([
        { id: "current-skill-roles", title: "Roles", entries: roleSkills },
        { id: "current-skill-other", title: "Other skills", entries: otherSkills },
      ]).filter(group => group.entries.length > 0).map(group => (
        <div key={group.id} id={group.id} className="scroll-mt-36 space-y-4">
          <h3 className="text-lg font-semibold">{group.title}</h3>
          {group.entries.map(skill => (
            <SectionCard key={skill.id} id={`system-skill-${skill.slug}`} className="scroll-mt-36">
              <SectionCardHeader title={skill.name} description={skill.description || skill.slug} />
              {expanded === skill.id && (
                <SectionCardContent>
                  <pre className="max-h-[500px] overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 font-mono text-xs text-muted-foreground">
                    {skill.content || "No instructions available."}
                  </pre>
                </SectionCardContent>
              )}
              <SectionCardFooter>
                <Button type="button" variant="outline" aria-expanded={expanded === skill.id}
                  onClick={() => setExpanded(current => current === skill.id ? null : skill.id)}>
                  {expanded === skill.id ? "Hide instructions" : "View instructions"}
                </Button>
              </SectionCardFooter>
            </SectionCard>
          ))}
        </div>
      ))}
      {!loading && !error && !loadedSkills?.length && (
        <p className="text-sm text-muted-foreground">No built-in skills are available.</p>
      )}
      {Boolean(loadedSkills?.length) && !visibleSkills.length && (
        <p className="text-sm text-muted-foreground">No skills match your search.</p>
      )}
    </section>
  )
}
