"use client"

import { useRef, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Button } from "@/app/components/ui/button"
import {
  Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/app/components/ui/dialog"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Textarea } from "@/app/components/ui/textarea"
import { getSkillResponseField, skillRequest, type ManagedSkill } from "./skill-client"

export type SkillDialogAction = { type: "add" } | { type: "edit"; skill: ManagedSkill } | { type: "import"; url: string }

export function SkillDialog({ action, siteId, trigger, renderTrigger = node => node, onActionChange, onSaved }: {
  action: SkillDialogAction | null
  siteId?: string
  trigger?: ReactNode
  renderTrigger?: (trigger: ReactNode) => ReactNode
  onActionChange: (action: SkillDialogAction | null) => void
  onSaved: () => void
}) {
  const [pending, setPending] = useState(false)

  return <Dialog open={Boolean(action)} onOpenChange={open => {
    if (open) onActionChange({ type: "add" })
    else if (!pending) onActionChange(null)
  }}>
    {trigger && renderTrigger(<DialogTrigger asChild>{trigger}</DialogTrigger>)}
    {action && siteId && <SkillDialogContent action={action} siteId={siteId} pending={pending} setPending={setPending}
      onSaved={() => { onSaved(); onActionChange(null) }} />}
  </Dialog>
}

function SkillDialogContent({ action, siteId, pending, setPending, onSaved }: {
  action: SkillDialogAction
  siteId: string
  pending: boolean
  setPending: (pending: boolean) => void
  onSaved: () => void
}) {
  const editingId = action.type === "edit" ? action.skill.id : undefined
  const [mode, setMode] = useState(action.type === "import" ? "import" : "upload")
  const [content, setContent] = useState(action.type === "edit" ? action.skill.content || "" : "")
  const [url, setUrl] = useState(action.type === "import" ? action.url : "")
  const [preview, setPreview] = useState<{ content: string; sha256: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasFrontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(content.replace(/^\uFEFF/, ""))
  const importing = mode === "import"

  async function run(operation: () => Promise<void>) {
    setPending(true)
    try { await operation() }
    catch (error) { toast.error(error instanceof Error ? error.message : "Skill request failed") }
    finally { setPending(false) }
  }

  return <DialogContent busy={pending} size="lg">
    <DialogHeader>
      <DialogTitle>{editingId ? "Edit skill" : action.type === "import" ? "Import skill" : "Add skill"}</DialogTitle>
      <DialogDescription>{importing
        ? "Review the instructions from a public GitHub SKILL.md before importing. Community instructions are untrusted."
        : "Select a SKILL.md file or paste its Markdown. Start with a frontmatter header and a name field; never include API keys or credentials."}</DialogDescription>
    </DialogHeader>
    <DialogBody className="space-y-4">
      {action.type === "add" && <div role="group" aria-label="How to add a skill" className="flex flex-wrap gap-2">
        <Button size="sm" variant={importing ? "outline" : "secondary"} aria-pressed={!importing}
          disabled={pending} onClick={() => setMode("upload")}>Upload</Button>
        <Button size="sm" variant={importing ? "secondary" : "outline"} aria-pressed={importing}
          disabled={pending} onClick={() => setMode("import")}>Import from URL</Button>
      </div>}
      {importing ? <div className="space-y-2">
        <Label htmlFor="external-url">Community skill URL (HTTPS)</Label>
        <Input id="external-url" type="url" value={url} disabled={pending}
          onChange={event => { setUrl(event.target.value); setPreview(null) }} placeholder="https://github.com/.../SKILL.md" />
        {preview && <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs"
          aria-label="Community skill preview">{preview.content}</pre>}
      </div> : <div className="space-y-2">
        <Label htmlFor="skill-content">Skill Markdown</Label>
        <Textarea id="skill-content" className="min-h-36 font-mono" value={content} disabled={pending}
          onChange={event => setContent(event.target.value)} aria-invalid={Boolean(content.trim()) && !hasFrontmatter}
          aria-describedby={content.trim() && !hasFrontmatter ? "skill-frontmatter-error" : undefined}
          placeholder="---\nname: my-skill\ndescription: ...\n---\n# Instructions" />
        {content.trim() && !hasFrontmatter && <p id="skill-frontmatter-error" role="alert" className="text-sm text-destructive">
          SKILL.md must start with a frontmatter header (---, name: ..., ---). Do not include API keys or credentials.
        </p>}
      </div>}
    </DialogBody>
    <DialogFooter>
      {importing ? <>
        <Button variant="outline" disabled={pending || !url.trim()} onClick={() => void run(async () => {
          setPreview(null)
          const result = await skillRequest("/api/skills/external/preview", "POST", { site_id: siteId, url: url.trim() })
          const data = getSkillResponseField(result, "preview")
          const content = getSkillResponseField(data, "content")
          const sha256 = getSkillResponseField(data, "sha256")
          if (typeof content !== "string" || !content || typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256)) {
            throw new Error("Could not preview this skill")
          }
          setPreview({ content, sha256 })
        })}>Preview</Button>
        <Button disabled={pending || !preview} onClick={() => {
          if (!preview) return
          void run(async () => {
            await skillRequest("/api/skills/external/import", "POST", { site_id: siteId, url: url.trim(), sha256: preview.sha256 })
            toast.success("Skill imported")
            onSaved()
          })
        }}>Import reviewed skill</Button>
      </> : <>
        <input ref={inputRef} type="file" accept=".md,text/markdown,text/plain"
          aria-label="SKILL.md file" className="sr-only" tabIndex={-1} disabled={pending}
          onChange={event => {
            const file = event.target.files?.[0]
            if (!file) return
            event.target.value = ""
            if (file.size > 131_072) { toast.error("Skill must be smaller than 128 KB"); return }
            void run(async () => setContent(await file.text()))
          }} />
        <Button variant="outline" disabled={pending} onClick={() => inputRef.current?.click()}>Select file</Button>
        <Button disabled={pending || !content.trim() || !hasFrontmatter} onClick={() => void run(async () => {
          await skillRequest(editingId ? `/api/skills/${editingId}` : "/api/skills", editingId ? "PATCH" : "POST", { site_id: siteId, content })
          toast.success(editingId ? "Skill updated" : "Skill uploaded")
          onSaved()
        })}>{editingId ? "Save changes" : "Upload skill"}</Button>
      </>}
    </DialogFooter>
  </DialogContent>
}