/** Shared name-derived slug used by storefront and tender routes. */
export function toSiteSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}