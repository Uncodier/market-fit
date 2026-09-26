"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { AlertTriangle, Trash2 } from "@/app/components/ui/icons"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import { Textarea } from "@/app/components/ui/textarea"
import {
  SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader,
} from "@/app/components/ui/section-card"

export type ManagedSkill = {
  id: string
  slug: string
  name: string
  description?: string
  content?: string
  source?: string
  enabled?: boolean
  url?: string
}

export function skillsFromResponse(value: unknown): ManagedSkill[] {
  if (!value || typeof value !== "object") return []
  const data = value as Record<string, unknown>
  const entries = Array.isArray(value) ? value : Array.isArray(data.skills) ? data.skills :
    Array.isArray(data.results) ? data.results : Array.isArray(data.data) ? data.data : []
  return entries.filter((entry): entry is ManagedSkill => Boolean(entry && typeof entry === "object" &&
    typeof entry.id === "string" && typeof entry.slug === "string" && typeof entry.name === "string"))
}

export async function skillRequest(url: string, method = "GET", body?: Record<string, unknown>): Promise<any> {
  const response = await fetch(url, {
    method,
    ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    cache: "no-store",
  })
  const result = await response.json()
  if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : result.error?.message || "Skill request failed")
  return result
}

export function SkillManager() {
  const { currentSite } = useSite()
  const siteId = currentSite?.id
  const [skills, setSkills] = useState<ManagedSkill[]>([])
  const [content, setContent] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [skillToDelete, setSkillToDelete] = useState<ManagedSkill | null>(null)
  const [pending, setPending] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasFrontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(content.replace(/^\uFEFF/, ""))

  const refresh = useCallback(async () => {
    if (!siteId) return
    try {
      setSkills(skillsFromResponse(await skillRequest(`/api/skills?site_id=${encodeURIComponent(siteId)}`))
        .filter(skill => skill.source !== "system"))
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not load skills") }
  }, [siteId])

  useEffect(() => {
    setSkills([])
    setContent("")
    setEditingId(null)
    setSkillToDelete(null)
    void refresh()
  }, [refresh])

  async function run(operation: () => Promise<void>) {
    setPending(true)
    try { await operation(); await refresh() }
    catch (error) { toast.error(error instanceof Error ? error.message : "Skill request failed") }
    finally { setPending(false) }
  }

  async function deleteSkill() {
    if (!skillToDelete || !siteId) return
    setPending(true)
    try {
      await skillRequest(`/api/skills/${skillToDelete.id}`, "DELETE", { site_id: siteId })
      if (editingId === skillToDelete.id) {
        setEditingId(null)
        setContent("")
      }
      await refresh()
      toast.success("Skill deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete skill")
      throw error
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6" aria-label="Manage skills">
      <SectionCard id="skill-editor">
        <SectionCardHeader
          title={editingId ? "Edit skill" : "Upload a skill"}
          description="Upload a SKILL.md file or paste its Markdown. Start with --- and a name field; never upload API keys or credentials."
        />
        <SectionCardContent>
          <div className="space-y-2">
            <Label htmlFor="skill-content">Skill Markdown</Label>
            <Textarea id="skill-content" className="min-h-36 font-mono" value={content} disabled={pending}
              onChange={event => setContent(event.target.value)}
              aria-invalid={Boolean(content.trim()) && !hasFrontmatter}
              aria-describedby={content.trim() && !hasFrontmatter ? "skill-frontmatter-error" : undefined}
              placeholder="---\nname: my-skill\ndescription: ...\n---\n# Instructions" />
            {content.trim() && !hasFrontmatter && (
              <p id="skill-frontmatter-error" role="alert" className="text-sm text-destructive">
                SKILL.md must start with a frontmatter header (---, name: ..., ---). Do not include API keys or credentials.
              </p>
            )}
          </div>
        </SectionCardContent>
        <SectionCardFooter>
          <input ref={fileInputRef} id="skill-file" type="file" accept=".md,text/markdown,text/plain"
            aria-label="SKILL.md file" className="sr-only" tabIndex={-1} disabled={pending}
            onChange={async event => {
              const file = event.target.files?.[0]
              if (!file) return
              event.target.value = ""
              if (file.size > 131_072) { toast.error("Skill must be smaller than 128 KB"); return }
              setEditingId(null)
              setContent(await file.text())
            }} />
          <Button type="button" variant="outline" disabled={pending || !siteId}
            onClick={() => fileInputRef.current?.click()}>Select file</Button>
          {editingId && <Button variant="outline" disabled={pending} onClick={() => {
            setEditingId(null)
            setContent("")
          }}>Cancel edit</Button>}
          <Button disabled={pending || !siteId || !content.trim() || !hasFrontmatter} onClick={() => void run(async () => {
            await skillRequest(editingId ? `/api/skills/${editingId}` : "/api/skills", editingId ? "PATCH" : "POST", { site_id: siteId, content })
            setContent("")
            setEditingId(null)
            toast.success(editingId ? "Skill updated" : "Skill uploaded")
          })}>{editingId ? "Save changes" : "Upload skill"}</Button>
        </SectionCardFooter>
      </SectionCard>

      {skills.length > 0 ? (
        <section id="site-skills" className="space-y-4" aria-label="Your skills">
          <div>
            <h2 className="text-lg font-semibold">Your skills</h2>
            <p className="text-sm text-muted-foreground">Edit, enable, or remove the skills created or imported for this site.</p>
          </div>
          {skills.map(skill => (
            <SectionCard key={skill.id}>
              <SectionCardHeader
                title={skill.name}
                description={`${skill.slug} · ${skill.enabled === false ? "Disabled" : skill.source === "github" ? "Community" : "Site skill"}`}
                actions={
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`skill-enabled-${skill.id}`} className="text-xs text-muted-foreground">Enabled</Label>
                    <Switch id={`skill-enabled-${skill.id}`} checked={skill.enabled !== false} disabled={pending || !siteId}
                      onCheckedChange={checked => void run(async () => {
                        await skillRequest(`/api/skills/${skill.id}`, "PATCH", { site_id: siteId, enabled: checked })
                        toast.success(checked ? "Skill enabled" : "Skill disabled")
                      })} />
                  </div>
                }
              />
              {skill.description && (
                <SectionCardContent>
                  <p className="text-sm text-muted-foreground">{skill.description}</p>
                </SectionCardContent>
              )}
              <SectionCardFooter>
                <Button size="sm" variant="outline" disabled={pending} onClick={() => {
                  setEditingId(skill.id)
                  setContent(skill.content || "")
                  document.getElementById("skill-editor")?.scrollIntoView({ behavior: "smooth" })
                }}>Edit</Button>
                <Button type="button" size="sm" variant="outline" disabled={pending}
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setSkillToDelete(skill)}>
                  <Trash2 size={16} /> Delete
                </Button>
              </SectionCardFooter>
            </SectionCard>
          ))}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">No administrable skills yet. Upload or import one to get started.</p>
      )}
      <ConfirmDialog open={Boolean(skillToDelete)} onOpenChange={open => { if (!open) setSkillToDelete(null) }}
        title={`Delete ${skillToDelete?.name || "skill"}?`} confirmLabel="Delete skill"
        variant="destructive" loading={pending} onConfirm={deleteSkill}
        description={<span className="flex items-start gap-2">
          <AlertTriangle size={18} className="text-destructive" />
          <span>This skill will be permanently deleted. This action cannot be undone.</span>
        </span>} />
    </div>
  )
}
