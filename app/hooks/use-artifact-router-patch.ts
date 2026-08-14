"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

function appendArtifactIfNeeded(href: string): string {
  if (typeof href !== "string") return href
  const currentUrlParams = new URLSearchParams(window.location.search)
  if (currentUrlParams.get("artifact") !== "true") return href
  if (!(href.startsWith("/") || href.startsWith("?") || href.startsWith("#"))) return href

  const [pathAndSearch, hash] = href.split("#")
  const [path, search] = pathAndSearch.split("?")
  const params = new URLSearchParams(search || "")
  if (params.has("artifact")) return href
  params.set("artifact", "true")
  return `${path}?${params.toString()}${hash !== undefined ? `#${hash}` : ""}`
}

/**
 * Keep client navigations and DOM links on ?artifact=true when the current URL has it.
 */
export function useArtifactRouterPatch(): void {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!router || !router.push) return

    const isArtifactInUrl = new URLSearchParams(window.location.search).get("artifact") === "true"
    if (!isArtifactInUrl) return

    if (!(router as any)._patchedForArtifact) {
      const originalPush = router.push
      const originalReplace = router.replace
      const originalPrefetch = router.prefetch

      router.push = (href: string, options?: any) => {
        return originalPush.call(router, appendArtifactIfNeeded(href), options)
      }
      router.replace = (href: string, options?: any) => {
        return originalReplace.call(router, appendArtifactIfNeeded(href), options)
      }
      if (originalPrefetch) {
        router.prefetch = (href: string, options?: any) => {
          return originalPrefetch.call(router, appendArtifactIfNeeded(href), options)
        }
      }
      ;(router as any)._patchedForArtifact = true
    }

    const updateLinks = () => {
      document.querySelectorAll("a[href]").forEach((a) => {
        const href = a.getAttribute("href")
        if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return
        if (href.startsWith("/") || href.startsWith("?") || href.startsWith("#")) {
          const next = appendArtifactIfNeeded(href)
          if (next !== href) a.setAttribute("href", next)
        }
      })
    }

    updateLinks()

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          updateLinks()
          return
        }
        if (mutation.type === "attributes" && mutation.attributeName === "href") {
          const target = mutation.target as HTMLAnchorElement
          const href = target.getAttribute("href")
          if (target.tagName === "A" && href && !href.includes("artifact=true")) {
            updateLinks()
            return
          }
        }
      }
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href"],
    })

    return () => observer.disconnect()
  }, [router, pathname, searchParams])
}
