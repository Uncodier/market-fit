const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

export function isRobotConnectorId(id: unknown): id is string {
  return typeof id === 'string' && id.length === 36 && uuid.test(id)
}

/** Undefined: ordinary conversation. Null: ambiguous/malformed; never silently unpin. */
export function robotConnectorHint(params: Pick<URLSearchParams, 'getAll'>): string | null | undefined {
  const values = params.getAll('connector')
  if (!values.length) return undefined
  return values.length === 1 && isRobotConnectorId(values[0]) ? values[0].toLowerCase() : null
}