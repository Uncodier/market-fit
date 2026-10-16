export const DISTRIBUTION_DESTINATIONS = new Set([
  "mail", "newsletter", "whatsapp", "telegram", "sms", "voice", "voice-agent-call",
])

export type PublishDestination = {
  mode: string
  kind?: "connection" | "social"
  id?: string
}

export function publishDestinationKey(mode: string, kind: "connection" | "social", id: string): string {
  return `${mode}:${kind}:${encodeURIComponent(id)}`
}

/** Persist IDs, never labels, addresses, or client-supplied provider credentials. */
export function parsePublishDestination(value: string): PublishDestination {
  const match = /^([^:]+):(connection|social):(.+)$/.exec(value)
  if (!match) {
    if (value.includes(":")) throw new Error("Invalid publish destination")
    return { mode: value === "twitter" ? "x" : value }
  }
  let id: string
  try {
    id = decodeURIComponent(match[3])
  } catch {
    throw new Error("Invalid publish destination ID")
  }
  const mode = match[1] === "twitter" ? "x" : match[1]
  const kind = match[2] as "connection" | "social"
  if (!id.trim() || id.trim() !== id || id.length > 200 || /[\x00-\x1f\x7f]/.test(id)
    || (kind === "connection") !== DISTRIBUTION_DESTINATIONS.has(mode)) {
    throw new Error("Invalid publish destination")
  }
  return { mode, kind, id }
}

export function publishDestinationMode(value: string): string {
  // UI inspection must not make corrupt persisted selections crash the canvas.
  // Execution still uses the strict parser below and rejects malformed IDs.
  try {
    return parsePublishDestination(value).mode
  } catch {
    return value.split(":", 1)[0]
  }
}

export function destinationChannel(mode: string): string | undefined {
  if (mode === "mail" || mode === "newsletter") return "email"
  if (mode === "voice-agent-call") return "voice"
  return DISTRIBUTION_DESTINATIONS.has(mode) ? mode : undefined
}

export function effectivePublishDestinations(destinations: string[]): string[] {
  return destinations.some((value) => parsePublishDestination(value).mode === "voice-agent-call")
    ? destinations.filter((value) => {
        const mode = parsePublishDestination(value).mode
        return mode === "voice-agent-call" || !DISTRIBUTION_DESTINATIONS.has(mode)
      })
    : destinations
}

export function getPublishTestRecipientKinds(destinations: string[]) {
  const modes = destinations.map(publishDestinationMode)
  return {
    email: modes.some((mode) => ["mail", "newsletter", "email"].includes(mode)),
    phone: modes.some((mode) => ["whatsapp", "call", "sms", "telegram", "voice", "voice-agent-call", "mensaje", "message"].includes(mode)),
  }
}