/** Background recovery must never replace an active POS document. */
export function isPosDocument(pathname: string): boolean {
  return pathname === "/pos" || pathname.startsWith("/pos/")
}

/** This policy is not an authorization gate; confirmed revocations stay separate. */
export function shouldDeferDocumentReload(): boolean {
  return typeof window !== "undefined" &&
    (isPosDocument(window.location.pathname) || !navigator.onLine)
}