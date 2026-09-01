"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { appendArtifactIfNeeded, shouldPreserveArtifact } from "@/lib/navigation/artifact-url"
import { navigateOrAssign } from "@/lib/navigation/stale-router"

/**
 * Keep client navigations and DOM links on ?artifact=true when the current URL has it.
 */
export function useArtifactRouterPatch(): void {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 1. programmatic nav and link mutation patch
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!router || !router.push) return

    if (!shouldPreserveArtifact()) return

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
  }, [router])

  // 2. capture-phase click listener for plain Next.js links or raw anchors that escaped the mutation
  useEffect(() => {
    if (typeof window === "undefined") return
    if (!shouldPreserveArtifact()) return

    const handleClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
      if (!shouldPreserveArtifact()) return

      let target = e.target as HTMLElement | null
      while (target && target.tagName !== "A") {
        target = target.parentElement
      }
      if (!target) return

      const anchor = target as HTMLAnchorElement
      if (anchor.hasAttribute("download")) return
      const linkTarget = anchor.getAttribute("target")
      if (linkTarget && linkTarget !== "_self") return

      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return
      if (href.startsWith("#") || href.startsWith("javascript:")) return
      if (!(href.startsWith("/") || href.startsWith("?"))) return

      e.preventDefault()
      e.stopPropagation()
      navigateOrAssign(router, appendArtifactIfNeeded(href))
    }

    document.addEventListener("click", handleClick, { capture: true })
    return () => document.removeEventListener("click", handleClick, { capture: true })
  }, [router])

  // 3. restore logic
  useEffect(() => {
    if (typeof window === "undefined") return
    if (shouldPreserveArtifact() && searchParams.get("artifact") !== "true") {
      const p = new URLSearchParams(searchParams.toString())
      p.set("artifact", "true")
      const newUrl = `${pathname}?${p.toString()}`
      router.replace(newUrl)
    }
  }, [pathname, searchParams, router])
}
