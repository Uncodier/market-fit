/** Match category names without changing punctuation or accents. */
export function catalogImportCategoryKey(name: string): string {
  return name.trim().replace(/[ \t\n\r\v\f]+/g, " ").toLowerCase()
}