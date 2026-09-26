"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs"
import { BookOpen, UploadCloud } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { Badge } from "@/app/components/ui/badge"
import { skillsFromResponse, type ManagedSkill } from "@/app/components/settings/SkillManager"

export type SkillSelection = { skill_mode: "auto" | "required"; skill_slugs: string[] }

export function SkillSelector({ siteId, value, onChange, disabled }: {
  siteId?: string; value: SkillSelection; onChange: (value: SkillSelection) => void; disabled?: boolean
}) {
  const [skills, setSkills] = useState<ManagedSkill[]>([])
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    setSkills([])
    setOpen(false)
    if (!siteId) return
    let controller: AbortController | undefined
    const refresh = () => {
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      fetch(`/api/skills?site_id=${encodeURIComponent(siteId)}`, { signal, cache: "no-store" })
        .then(response => response.ok ? response.json() : Promise.reject(new Error("Could not load skills")))
        .then(result => { if (!signal.aborted) setSkills(skillsFromResponse(result).filter(skill => skill.enabled !== false)) })
        .catch(() => { if (!signal.aborted) setSkills([]) })
    }
    refresh()
    window.addEventListener("focus", refresh)
    window.addEventListener("skill-catalog-updated", refresh)
    return () => {
      controller?.abort()
      window.removeEventListener("focus", refresh)
      window.removeEventListener("skill-catalog-updated", refresh)
    }
  }, [siteId])

  useEffect(() => {
    if (!open) return
    const dismissOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener("pointerdown", dismissOutside)
    document.addEventListener("keydown", dismissOnEscape)
    return () => {
      document.removeEventListener("pointerdown", dismissOutside)
      document.removeEventListener("keydown", dismissOnEscape)
    }
  }, [open])

  return <div ref={rootRef} className="relative">
    <Button
      ref={triggerRef}
      type="button"
      variant="secondary"
      size="sm"
      disabled={disabled || !siteId}
      aria-label="Select skills"
      aria-expanded={open}
      aria-controls={open ? `${id}-options` : undefined}
      title={value.skill_mode === "auto" ? "Skills: Auto" : `Skills: ${value.skill_slugs.length} selected`}
      onClick={() => setOpen(current => !current)}
      className="h-8 px-3 hover:bg-secondary/80 transition-colors duration-200"
    >
      <BookOpen className="h-4 w-4 text-purple-600" />
      <span className="ml-1">skills</span>
      {value.skill_mode === "required" && value.skill_slugs.length > 0 && (
        <Badge variant="outline" className="ml-1.5 h-5 px-1.5 py-0 text-[10px] flex items-center justify-center">
          {value.skill_slugs.length}
        </Badge>
      )}
    </Button>
    {open && <div id={`${id}-options`} role="group" aria-label="Skill selection options" className="absolute bottom-full left-0 z-[100] mb-1 w-64 rounded-md border bg-background p-3 shadow-lg">
      <Tabs value={value.skill_mode} onValueChange={mode => {
        if (mode === "auto" || mode === "required") {
          onChange({ skill_mode: mode, skill_slugs: [] })
        }
      }}>
        <TabsList className="grid w-full grid-cols-2" aria-label="Skill mode">
          <TabsTrigger value="auto" disabled={disabled}>Auto</TabsTrigger>
          <TabsTrigger value="required" disabled={disabled}>Selected</TabsTrigger>
        </TabsList>
        <TabsContent value="auto" className="text-xs text-muted-foreground">
          The assistant discovers skills when needed.
        </TabsContent>
        <TabsContent value="required" className="max-h-44 overflow-auto text-sm">
          <input aria-label="Filter skills" className="w-full rounded-md border bg-background p-1 text-sm" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a skill" />
          {skills.length ? skills.filter(skill => `${skill.name} ${skill.slug}`.toLowerCase().includes(search.toLowerCase())).map(skill => <label key={skill.id} className="flex gap-2 py-1">
            <input type="checkbox" checked={value.skill_slugs.includes(skill.slug)} disabled={disabled || (value.skill_slugs.length >= 5 && !value.skill_slugs.includes(skill.slug))}
              onChange={event => onChange({ skill_mode: "required", skill_slugs: event.target.checked ? [...value.skill_slugs, skill.slug] : value.skill_slugs.filter(slug => slug !== skill.slug) })} />{skill.name}
          </label>) : <p className="text-muted-foreground">No site skills available. Add them on the Skills page.</p>}
          <p className="text-xs text-muted-foreground">Select 1–5 skills.</p>
        </TabsContent>
      </Tabs>
      <div role="menu" aria-label="Skill actions" className="mt-2 border-t pt-2">
        <Link role="menuitem" href="/skills?tab=manage#skill-editor" className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <UploadCloud className="h-4 w-4" />
          Upload new skill
        </Link>
      </div>
    </div>}
  </div>
}