export type DeleteContentOptions = {
  deleteFromOutstand?: boolean
}

export type DeleteContentResult =
  | { success: true; error?: never }
  | { success: false; error: string; status?: number }

// Only explicit links count. Similar titles or text are not deletion targets.
export function getLinkedOutstandPostIds(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  return Array.from(new Set(tags
    .filter((tag): tag is string => typeof tag === "string" && tag.startsWith("outstand_id_"))
    .map(tag => tag.slice("outstand_id_".length))))
}