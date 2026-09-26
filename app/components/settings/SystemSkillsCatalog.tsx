"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { Search } from "@/app/components/ui/icons"
import { Input } from "@/app/components/ui/input"
import type { QuickNavSection } from "@/app/components/ui/quick-nav"
import {
  SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader,
} from "@/app/components/ui/section-card"
import { skillRequest, skillsFromResponse, type ManagedSkill } from "./SkillManager"

export function SystemSkillsCatalog({ onSectionsChange }: { onSectionsChange?: (sections: QuickNavSection[]) => void }) {
  const { currentSite } = useSite()
  const siteId = currentSite?.id
  const [skills, setSkills] = useState<ManagedSkill[]>([])
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSkills([])
    setExpanded(null)
    setQuery("")
    setFilter("")
    setError(null)
    if (!siteId) return
    let active = true
    setLoading(true)
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
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [siteId])

  const visibleSkills = useMemo(() => skills.filter(skill => `${skill.name} ${skill.slug} ${skill.description || ""}`
    .toLowerCase().includes(filter.trim().toLowerCase())), [skills, filter])
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
      <form role="search" onSubmit={event => {
        event.preventDefault()
        if (loading || !siteId) return
        setFilter(query.trim())
      }}>
        <div role="toolbar" aria-label="Makinari skill search" className="flex items-center rounded-lg border border-input bg-background p-1 focus-within:ring-2 focus-within:ring-ring">
          <Input aria-label="Search Makinari skills" value={query} onChange={event => setQuery(event.target.value)}
            className="min-w-0 flex-1 !h-9 !rounded-none !border-0 !bg-transparent !ring-0 focus-visible:!ring-0"
            placeholder="Search Makinari skills" />
          <Button type="submit" size="sm" variant="ghost" className="shrink-0 gap-2"
            disabled={loading || !siteId || (!query.trim() && !filter)}>
            <Search size={16} /> Search
          </Button>
        </div>
      </form>
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading Makinari skills...</p>}
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
      {!loading && !error && !skills.length && (
        <p className="text-sm text-muted-foreground">No built-in skills are available.</p>
      )}
      {!loading && !error && skills.length > 0 && !visibleSkills.length && (
        <p className="text-sm text-muted-foreground">No skills match your search.</p>
      )}
    </section>
  )
}
