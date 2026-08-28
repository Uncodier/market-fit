export type DestinationSite = { id: string; name: string }

export function mergeDestinationSites(
  memberSites: DestinationSite[],
  ownedSites: DestinationSite[]
): DestinationSite[] {
  const combined = [...memberSites]
  for (const site of ownedSites) {
    if (!combined.some((s) => s.id === site.id)) {
      combined.push(site)
    }
  }
  return combined
}

export function sameDestinationSites(
  a: DestinationSite[],
  b: DestinationSite[]
): boolean {
  if (a.length !== b.length) return false
  return a.every(
    (site, index) => site.id === b[index].id && site.name === b[index].name
  )
}
