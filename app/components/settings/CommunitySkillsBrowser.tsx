"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { GitFork, Search, Star } from "@/app/components/ui/icons"
import {
  SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader,
} from "@/app/components/ui/section-card"
import { skillRequest } from "./SkillManager"

type CommunitySkill = {
  name: string; description?: string; url: string; repository?: string; stars?: number; forks?: number
}
type SkillPreview = { content: string; sha256: string }

export function CommunitySkillsBrowser() {
  const { currentSite } = useSite()
  const siteId = currentSite?.id
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CommunitySkill[]>([])
  const [searched, setSearched] = useState(false)
  const [resultPreviews, setResultPreviews] = useState<Record<string, SkillPreview>>({})
  const [url, setUrl] = useState("")
  const [importPreview, setImportPreview] = useState<SkillPreview | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    setResults([])
    setSearched(false)
    setResultPreviews({})
    setUrl("")
    setImportPreview(null)
  }, [siteId])

  async function run(operation: () => Promise<void>) {
    setPending(true)
    try { await operation() }
    catch (error) { toast.error(error instanceof Error ? error.message : "Skill request failed") }
    finally { setPending(false) }
  }

  const readPreview = async (requestedUrl: string): Promise<SkillPreview> => {
    const result = await skillRequest("/api/skills/external/preview", "POST", { site_id: siteId, url: requestedUrl })
    return {
      content: typeof result.preview?.content === "string" ? result.preview.content : JSON.stringify(result.preview, null, 2),
      sha256: typeof result.preview?.sha256 === "string" ? result.preview.sha256 : "",
    }
  }

  return (
    <div className="space-y-6" aria-label="Browse community skills">
      <section id="community-skills" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Browse community skills</h2>
          <p className="text-sm text-muted-foreground">Find public GitHub skills. Review their instructions before adding them: community instructions are untrusted.</p>
        </div>
        <form role="search" className="space-y-2" onSubmit={event => {
          event.preventDefault()
          if (pending || !siteId || !query.trim()) return
          void run(async () => {
            setResults([])
            setResultPreviews({})
            setSearched(false)
            const result = await skillRequest(`/api/skills/external?site_id=${encodeURIComponent(siteId)}&query=${encodeURIComponent(query)}`)
            setResults(Array.isArray(result.results) ? result.results.filter((entry: CommunitySkill) =>
              entry && typeof entry.url === "string" && typeof entry.name === "string") : [])
            setSearched(true)
          })
        }}>
          <Label htmlFor="community-query">Search community skills</Label>
          <div role="toolbar" aria-label="Community skill search" className="flex items-center rounded-lg border border-input bg-background p-1 focus-within:ring-2 focus-within:ring-ring">
            <Input id="community-query" value={query} disabled={pending} className="min-w-0 flex-1 !h-9 !rounded-none !border-0 !bg-transparent !ring-0 focus-visible:!ring-0"
              onChange={event => setQuery(event.target.value)} placeholder="Search skills" />
            <Button type="submit" size="sm" variant="ghost" className="shrink-0 gap-2" disabled={pending || !siteId || !query.trim()}>
              <Search size={16} /> Search
            </Button>
          </div>
        </form>
      </section>

      <section id="community-results" className="space-y-4" aria-label="Community search results" hidden={!searched}>
        {searched && <h2 className="text-lg font-semibold">Search results</h2>}
        {searched && results.length === 0 && <p className="text-sm text-muted-foreground">No community skills found for this search.</p>}
        {searched && results.map((skill, index) => {
          const reviewed = resultPreviews[skill.url]
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
              {(skill.description || reviewed) && (
                <SectionCardContent>
                  {skill.description && <p className="text-sm text-muted-foreground">{skill.description}</p>}
                  {reviewed && (
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs" aria-label={`Preview of ${skill.name}`}>
                      {reviewed.content}
                    </pre>
                  )}
                </SectionCardContent>
              )}
              <SectionCardFooter>
                <Button variant="outline" disabled={pending || !siteId} onClick={() => void run(async () => {
                  setResultPreviews(current => { const next = { ...current }; delete next[skill.url]; return next })
                  const nextPreview = await readPreview(skill.url)
                  setResultPreviews(current => ({ ...current, [skill.url]: nextPreview }))
                })}>Preview</Button>
                <Button disabled={pending || !siteId || !reviewed?.content || !reviewed.sha256} onClick={() => void run(async () => {
                  await skillRequest("/api/skills/external/import", "POST", { site_id: siteId, url: skill.url, sha256: reviewed.sha256 })
                  setResultPreviews(current => { const next = { ...current }; delete next[skill.url]; return next })
                  toast.success("Skill imported")
                })}>Add</Button>
              </SectionCardFooter>
            </SectionCard>
          )
        })}
      </section>

      <SectionCard id="community-import" aria-label="Import a community skill from URL">
        <SectionCardHeader
          title="Import from URL"
          description="Paste a public GitHub SKILL.md URL, review its instructions, then import the version you previewed."
        />
        <SectionCardContent>
          <div className="space-y-2">
            <Label htmlFor="external-url">Community skill URL (HTTPS)</Label>
            <Input id="external-url" type="url" value={url} disabled={pending}
              onChange={event => { setUrl(event.target.value); setImportPreview(null) }} placeholder="https://github.com/.../SKILL.md" />
          </div>
          {importPreview && (
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs" aria-label="Community skill preview">
              {importPreview.content}
            </pre>
          )}
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" disabled={pending || !siteId || !url.trim()} onClick={() => void run(async () => {
            setImportPreview(null)
            setImportPreview(await readPreview(url))
          })}>Preview</Button>
          <Button disabled={pending || !siteId || !importPreview?.content || !importPreview.sha256} onClick={() => void run(async () => {
            await skillRequest("/api/skills/external/import", "POST", { site_id: siteId, url, sha256: importPreview!.sha256 })
            setImportPreview(null)
            toast.success("Skill imported")
          })}>Import reviewed skill</Button>
        </SectionCardFooter>
      </SectionCard>
    </div>
  )
}
