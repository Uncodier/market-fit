export type SiteRefreshOptions = { recoverMissingSite?: boolean };

/** Explicit recovery may hydrate a missing POS context, never interrupt a live site. */
export function canRecoverMissingPosSite(options: SiteRefreshOptions | undefined, currentSiteId: string | undefined, pathname: string): boolean {
  return options?.recoverMissingSite === true && !currentSiteId && pathname === "/pos";
}