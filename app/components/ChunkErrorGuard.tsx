"use client"

import { useEffect } from "react"

/**
 * After a deployment, tabs that were already open keep referencing the previous
 * build's chunk hashes (e.g. `/_next/static/chunks/abc-<old-hash>.js`). As soon
 * as the user navigates or React tries to lazy-load anything, the request 404s
 * and the app throws `ChunkLoadError` / "Failed to fetch dynamically imported
 * module", which surfaces as a crash. Incognito works because it always fetches
 * a fresh HTML referencing the current chunks.
 *
 * This guard listens for those errors at the window level and forces a hard
 * reload so the browser pulls the latest HTML (and therefore the new chunk
 * hashes). A sessionStorage flag prevents reload loops if the underlying
 * problem is actually persistent (e.g. offline, broken deploy).
 */

const RELOAD_FLAG = "__chunk_reload_attempt"
// Longer TTL in dev: Turbopack HMR can emit transient ChunkLoadErrors that
// would otherwise thrash-reload the page (seen as GET loops in the terminal).
const RELOAD_TTL_MS = process.env.NODE_ENV === "development" ? 120_000 : 30_000

const CHUNK_ERROR_SIGNATURES = [
  "ChunkLoadError",
  "Loading chunk",
  "Loading CSS chunk",
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
]

function isChunkLoadError(value: unknown): boolean {
  if (!value) return false

  const error = value as { name?: string; message?: string } | Error
  const name = (error as { name?: string }).name ?? ""
  const message =
    typeof error === "string"
      ? error
      : (error as { message?: string }).message ?? ""

  // Turbopack HMR client chunks flake during local edits; reloading on those
  // creates GET loops without fixing anything.
  if (
    message.includes("[turbopack]_browser_dev_hmr-client") ||
    message.includes("hmr-client")
  ) {
    return false
  }

  if (name === "ChunkLoadError") return true

  return CHUNK_ERROR_SIGNATURES.some((sig) => message.includes(sig))
}

function shouldReload(): boolean {
  try {
    // URL fallback check in case sessionStorage is disabled/throws (e.g. Safari Private Mode)
    const url = new URL(window.location.href)
    const v = url.searchParams.get("_v")
    if (v) {
      const ts = Number.parseInt(v, 36)
      if (!Number.isNaN(ts) && Date.now() - ts < RELOAD_TTL_MS) {
        return false
      }
    }
  } catch {
    // Ignore URL parsing errors
  }

  try {
    const raw = sessionStorage.getItem(RELOAD_FLAG)
    if (!raw) return true

    const ts = Number.parseInt(raw, 10)
    if (Number.isNaN(ts)) return true

    return Date.now() - ts > RELOAD_TTL_MS
  } catch {
    // If sessionStorage is disabled and we didn't have a recent _v param,
    // we default to true to at least try recovering once, but the _v check 
    // above will prevent the infinite loop on the next iteration.
    return true
  }
}

function markReload(): void {
  try {
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()))
  } catch {
    // ignore: storage may be unavailable (private mode, quota, etc.)
  }
}

function reloadForNewBuild(): void {
  // Turbopack HMR emits fake/transient chunk load errors that cause brutal reload loops in dev.
  // We only need this guard in production for stale deployment chunks.
  if (process.env.NODE_ENV === "development") {
    console.error("[ChunkErrorGuard] Ignored chunk load error in development mode.");
    return;
  }

  if (!shouldReload()) {
    console.error(
      "[ChunkErrorGuard] Chunk load failure persists after a recent reload; aborting auto-reload to avoid a loop."
    )
    return
  }

  markReload()
  const url = new URL(window.location.href)
  url.searchParams.set("_v", Date.now().toString(36))
  window.location.replace(url.toString())
}

export default function ChunkErrorGuard() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        event.preventDefault?.()
        reloadForNewBuild()
      }
    }

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault?.()
        reloadForNewBuild()
      }
    }

    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onUnhandledRejection)

    return () => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onUnhandledRejection)
    }
  }, [])

  return null
}

export { isChunkLoadError, reloadForNewBuild }
