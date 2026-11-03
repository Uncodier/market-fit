const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function requirementIdFromRobotName(name?: string): string | null {
  const id = name?.replace(/^req-(?:runner|maint)-/, '')
  return name?.match(/^req-(?:runner|maint)-/) && id && UUID.test(id) ? id : null
}

export function linkedRunnerId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const id = (metadata as Record<string, unknown>).runner_instance_id
  return typeof id === 'string' && UUID.test(id) ? id : null
}