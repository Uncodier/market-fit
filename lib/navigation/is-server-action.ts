type HeaderReader = {
  get(name: string): string | null
}

export function isServerActionRequest(headers: HeaderReader): boolean {
  return Boolean(headers.get("next-action"))
}
