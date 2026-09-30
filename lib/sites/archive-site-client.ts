"use client"

import { clearCurrentSiteCookie } from "@/lib/auth/current-site-cookie"

const ARCHIVE_ERROR = "Unable to archive the site. Please try again."

export async function requestSiteArchive(siteId: string, password: string): Promise<void> {
  let response: Response
  try {
    response = await fetch("/api/sites/archive", {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId, password }),
    })
  } catch {
    throw new Error(ARCHIVE_ERROR)
  }

  let result: unknown
  try {
    result = await response.json()
  } catch {
    throw new Error(ARCHIVE_ERROR)
  }

  if (!result || typeof result !== "object") throw new Error(ARCHIVE_ERROR)
  if ("error" in result && typeof result.error === "string" && result.error.trim()) {
    throw new Error(result.error)
  }
  if (!response.ok || !("success" in result) || result.success !== true) {
    throw new Error(ARCHIVE_ERROR)
  }
}

export function leaveArchivedSite(siteId: string): void {
  if (typeof window === "undefined") return

  try {
    clearCurrentSiteCookie()
  } catch {
    // Restricted browser storage must not prevent leaving an archived workspace.
  }

  const keys = ["currentSiteId", `site_${siteId}_focusMode`, `site_${siteId}_focus_mode`]
  for (const key of keys) {
    try {
      window.localStorage.removeItem(key)
    } catch {
      // Continue clearing the other caches and navigating if storage is blocked.
    }
  }

  // A client-router refresh preserves provider state; replace the whole document.
  window.location.replace("/projects")
}