import { useLayoutEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { invalidateAgentsCache } from "@/app/agents/agents-cache"
import { isAgentUuid, upsertAgentRecord } from "@/app/agents/save-agent"
import { findTemplate, type EditorProfile } from "./editor-profile"

const sectionMessages = {
  basic: ["Basic information saved successfully", "Failed to save basic information"],
  prompt: ["Agent prompt saved successfully", "Failed to save agent prompt"],
  backstory: ["Agent backstory saved successfully", "Failed to save agent backstory"],
  activities: ["Activities saved successfully", "Failed to save activities"],
} as const
export type SaveSection = keyof typeof sectionMessages

function indexById<T extends { id: string }>(items: T[]) {
  return Object.fromEntries(items.map(({ id, ...data }) => [id, data]))
}

export function useEditorSave(siteId: string, routeId: string, profile: EditorProfile) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const current = useRef(false)
  const creationId = useRef<string | null>(null)
  const lastSaved = useRef(profile)
  useLayoutEffect(() => {
    current.current = true
    return () => { current.current = false }
  }, [])

  const blank = routeId === "new"
  const invalid = blank && (!profile.name.trim() || !findTemplate(profile.role))
  async function save(section: SaveSection) {
    if (pending.current || invalid || !current.current) return
    pending.current = true
    setSaving(true)
    let navigating = false
    const [success, failure] = sectionMessages[section]
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!current.current) return
      if (!session?.user) throw new Error("User not authenticated")
      if (blank) creationId.current ??= uuidv4()
      const previous = lastSaved.current
      const saveSupervisor = section === "basic" && profile.supervisor !== previous.supervisor
      const supervisorOnly = saveSupervisor && profile.persistedId !== null &&
        profile.name === previous.name && profile.description === previous.description && profile.status === previous.status
      const savedId = await upsertAgentRecord(supabase, {
        agentId: profile.persistedId ?? routeId, isNewAgent: blank,
        ...(profile.persistedId && { section }),
        ...(creationId.current && { creationId: creationId.current }),
        ...(saveSupervisor && { supervisor: profile.supervisor }),
        ...(supervisorOnly && { supervisorOnly: true }),
        siteId, userId: session.user.id, name: blank ? profile.name.trim() : profile.name,
        description: profile.description, prompt: profile.prompt, backstory: profile.backstory,
        type: profile.type, role: profile.role, status: profile.status,
        tools: indexById(profile.tools),
        integrations: indexById(profile.integrations.map(({ id, name, description, connected }) => ({ id, name, description, connected }))),
        activities: indexById(profile.activities.map((activity) => ({ ...activity, enabled: activity.status === "available" }))),
        configuration: { triggers: indexById(profile.triggers), contextFiles: profile.contextFiles },
      })
      invalidateAgentsCache()
      if (!current.current) return
      if (savedId !== routeId) {
        if (!isAgentUuid(savedId)) throw new Error("Agent was not saved")
        router.replace(`/agents/${savedId}`)
        navigating = true
      }
      // Only a successful Basic save advances the baseline for a reporting-line edit.
      if (section === 'basic') lastSaved.current = { ...previous, name: profile.name, description: profile.description,
        status: profile.status, supervisor: profile.supervisor }
      toast.success(success)
    } catch (error) {
      if (current.current) {
        const detail = error && typeof error === "object" && "message" in error ? String(error.message) : ""
        toast.error(detail ? `${failure}: ${detail}` : failure)
      }
    } finally {
      // Do not admit a second creation between a successful insert and route replacement.
      if (current.current && !navigating) {
        pending.current = false
        setSaving(false)
      }
    }
  }
  return { save, saving, disabled: saving || invalid }
}