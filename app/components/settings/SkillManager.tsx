"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { Button } from "@/app/components/ui/button"
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog"
import { AlertTriangle, Trash2 } from "@/app/components/ui/icons"
import { Label } from "@/app/components/ui/label"
import { Switch } from "@/app/components/ui/switch"
import {
  SectionCard, SectionCardContent, SectionCardFooter, SectionCardHeader,
} from "@/app/components/ui/section-card"
import { skillRequest, skillsFromResponse, type ManagedSkill } from "./skill-client"
import { SkillsLoading } from "./skills-loading"

export function SkillManager({ onEdit, revision = 0 }: { onEdit: (skill: ManagedSkill) => void; revision?: number }) {
  const { currentSite } = useSite()
  const siteId = currentSite?.id
  const [skills, setSkills] = useState<ManagedSkill[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [skillToDelete, setSkillToDelete] = useState<ManagedSkill | null>(null)
  const [pending, setPending] = useState(false)
  const [localRevision, setLocalRevision] = useState(0)

  useEffect(() => {
    if (!siteId) return
    let active = true
    skillRequest(`/api/skills?site_id=${encodeURIComponent(siteId)}`)
      .then(result => {
        if (!active) return
        setSkills(skillsFromResponse(result).filter(skill => skill.source !== "system"))
        setLoadError(null)
      })
      .catch(error => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load skills")
      })
    return () => { active = false }
  }, [siteId, revision, localRevision])

  async function run(operation: () => Promise<void>) {
    setPending(true)
    try { await operation(); setLocalRevision(current => current + 1) }
    catch (error) { toast.error(error instanceof Error ? error.message : "Skill request failed") }
    finally { setPending(false) }
  }

  async function deleteSkill() {
    if (!skillToDelete || !siteId) return
    setPending(true)
    try {
      await skillRequest(`/api/skills/${skillToDelete.id}`, "DELETE", { site_id: siteId })
      setLocalRevision(current => current + 1)
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
      {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
      {(skills?.length || (siteId && !skills && !loadError)) ? (
        <section id="site-skills" className="space-y-4" aria-label="Your skills">
          <div>
            <h2 className="text-lg font-semibold">Your skills</h2>
            <p className="text-sm text-muted-foreground">Edit, enable, or remove the skills created or imported for this site.</p>
          </div>
          {!skills && <SkillsLoading kind="managed" />}
          {skills?.map(skill => (
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
                <Button size="sm" variant="outline" disabled={pending} onClick={() => onEdit(skill)}>Edit</Button>
                <Button type="button" size="sm" variant="outline" disabled={pending}
                  className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setSkillToDelete(skill)}>
                  <Trash2 size={16} /> Delete
                </Button>
              </SectionCardFooter>
            </SectionCard>
          ))}
        </section>
      ) : !loadError && (
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
