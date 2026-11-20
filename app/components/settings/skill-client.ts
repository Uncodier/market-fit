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

export async function skillRequest(url: string, method = "GET", body?: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(url, {
    method,
    ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    cache: "no-store",
  })
  const result: unknown = await response.json()
  if (!response.ok) {
    const error = getSkillResponseField(result, "error")
    const message = typeof error === "string" ? error : getSkillResponseField(error, "message")
    throw new Error(typeof message === "string" && message ? message : "Skill request failed")
  }
  return result
}

export function getSkillResponseField(value: unknown, field: string): unknown {
  return value && typeof value === "object" && field in value ? (value as Record<string, unknown>)[field] : undefined
}