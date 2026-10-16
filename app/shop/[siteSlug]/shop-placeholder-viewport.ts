"use client"

const callbacks = new Map<Element, (near: boolean) => void>()
let observer: IntersectionObserver | null = null

/** One observer for all pending regions; scroll listeners are only active near the viewport. */
export function observeShopPlaceholder(element: Element, callback: (near: boolean) => void) {
  if (typeof IntersectionObserver === "undefined") return () => {}
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) callbacks.get(entry.target)?.(entry.isIntersecting)
    }, { rootMargin: "400px 0px", threshold: 0 })
  }
  callbacks.set(element, callback)
  observer.observe(element)
  return () => {
    callbacks.delete(element)
    observer?.unobserve(element)
    if (callbacks.size === 0) {
      observer?.disconnect()
      observer = null
    }
  }
}