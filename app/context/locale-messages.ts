export type MessageTree = { [key: string]: string | MessageTree }

/** Normalize mixed nested/dotted dictionaries; explicit dotted entries win. */
export function flattenMessages(messages: MessageTree): Record<string, string> {
  const flattened: Record<string, string> = {}
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value !== 'string') {
      for (const [childKey, childValue] of Object.entries(flattenMessages(value))) {
        flattened[`${key}.${childKey}`] = childValue
      }
    }
  }
  for (const [key, value] of Object.entries(messages)) {
    if (typeof value === 'string') flattened[key] = value
  }
  return flattened
}