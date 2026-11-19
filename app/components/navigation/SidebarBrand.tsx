"use client"

import { useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { NavigationLink } from "./NavigationLink"
import styles from "./sidebar-brand.module.css"

interface SidebarBrandProps {
  isCollapsed: boolean
}

const reducedMotionQuery = "(prefers-reduced-motion: reduce)"
// Allow the 300 ms sidebar transition to settle if transitionend is unavailable.
const collapseFallbackDelay = 350

export function SidebarBrand({ isCollapsed }: SidebarBrandProps) {
  const linkRef = useRef<HTMLAnchorElement>(null)
  const ballRef = useRef<SVGCircleElement>(null)
  const leverRef = useRef<SVGPathElement>(null)
  const animationsRef = useRef<Animation[]>([])
  const wasCollapsedRef = useRef(isCollapsed)
  const pendingLaunchRef = useRef<(() => void) | null>(null)

  const cancelPendingLaunch = useCallback(() => {
    pendingLaunchRef.current?.()
    pendingLaunchRef.current = null
  }, [])

  const cancelAnimations = useCallback(() => {
    cancelPendingLaunch()
    animationsRef.current.forEach(animation => animation.cancel())
    animationsRef.current = []
  }, [cancelPendingLaunch])

  const launchCatapult = useCallback(() => {
    const ball = ballRef.current
    const lever = leverRef.current
    if (
      !ball ||
      !lever ||
      typeof ball.animate !== "function" ||
      typeof lever.animate !== "function" ||
      window.matchMedia(reducedMotionQuery).matches ||
      animationsRef.current.some(animation => animation.playState === "running")
    ) return

    cancelAnimations()
    const timing = { duration: 820, iterations: 1 }
    const startTime = document.timeline.currentTime
    animationsRef.current = [
      lever.animate([
        { transform: "rotate(0deg)", offset: 0, easing: "ease-out" },
        { transform: "rotate(-12deg)", offset: 0.12, easing: "cubic-bezier(0.2, 0, 0.2, 1)" },
        { transform: "rotate(26deg)", offset: 0.24 },
        { transform: "rotate(26deg)", offset: 0.52, easing: "cubic-bezier(0.33, 0, 0.67, 0.33)" },
        { transform: "rotate(0deg)", offset: 1 },
      ], timing),
      ball.animate([
        { transform: "translateY(0)", offset: 0 },
        { transform: "translateY(0)", offset: 0.12, easing: "cubic-bezier(0.33, 0.67, 0.67, 1)" },
        { transform: "translateY(-640px)", offset: 0.52, easing: "cubic-bezier(0.33, 0, 0.67, 0.33)" },
        { transform: "translateY(0)", offset: 1 },
      ], timing),
    ]
    if (startTime !== null) {
      animationsRef.current.forEach(animation => { animation.startTime = startTime })
    }
  }, [cancelAnimations])

  useEffect(() => {
    const justCollapsed = isCollapsed && !wasCollapsedRef.current
    wasCollapsedRef.current = isCollapsed
    if (!isCollapsed) {
      cancelAnimations()
      return
    }
    if (!justCollapsed || window.matchMedia(reducedMotionQuery).matches) return

    const sidebar = linkRef.current?.closest("[data-collapsed]")
    const finishCollapse = () => {
      cancelPendingLaunch()
      launchCatapult()
    }
    const handleTransitionEnd = (event: Event) => {
      if (event.target === sidebar && (event as TransitionEvent).propertyName === "width") {
        finishCollapse()
      }
    }
    const timeout = window.setTimeout(finishCollapse, collapseFallbackDelay)
    sidebar?.addEventListener("transitionend", handleTransitionEnd)
    pendingLaunchRef.current = () => {
      window.clearTimeout(timeout)
      sidebar?.removeEventListener("transitionend", handleTransitionEnd)
    }
    return cancelPendingLaunch
  }, [isCollapsed, launchCatapult, cancelAnimations, cancelPendingLaunch])

  const launchOnInteraction = () => {
    if (!pendingLaunchRef.current) launchCatapult()
  }

  useEffect(() => {
    const preference = window.matchMedia(reducedMotionQuery)
    const handlePreferenceChange = () => {
      if (preference.matches) cancelAnimations()
    }
    preference.addEventListener("change", handlePreferenceChange)
    return () => {
      preference.removeEventListener("change", handlePreferenceChange)
      cancelAnimations()
    }
  }, [cancelAnimations])

  return (
    <NavigationLink
      ref={linkRef}
      href="/robots"
      className={cn(
        styles.brandLink,
        "flex items-center h-16 border-b dark:border-white/5 border-black/5 flex-none justify-center",
        isCollapsed ? "px-3" : "px-6"
      )}
      onMouseEnter={launchOnInteraction}
      onFocus={launchOnInteraction}
    >
      {isCollapsed ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1281 1488"
          fill="currentColor"
          role="img"
          aria-label="Makinari Logo"
          className={cn(styles.mark, "h-6 w-6 text-black dark:text-white")}
        >
          <path ref={leverRef} className={styles.lever} d="M100.5 1318.46C650 696.957 1028.5 271.957 1273.5 1.95677C1278.16 -2.52599 1283.46 1.42494 1279.4 6.45685C921.469 449.718 273.047 1378.38 242.5 1423.96C152.021 1558.96 -20.5662 1455.39 100.5 1318.46Z" />
          <path d="M483 1321.46L680.365 871.117C690.219 848.806 706.448 832.073 729.054 820.917C751.66 809.277 777.163 803.457 805.565 803.457C833.967 803.457 859.471 809.035 882.077 820.19C904.682 830.86 920.912 847.593 930.766 870.389L1129 1321.46H971.63L933.374 1223.24H804.261H675.148L635.153 1321.46H483ZM675.148 1223.24H804.261H933.374L818.607 919.134C817.448 916.224 815.709 914.284 813.39 913.314C811.651 911.858 809.333 911.131 806.435 911.131C803.537 911.131 800.928 911.858 798.61 913.314C796.871 914.769 795.712 916.709 795.132 919.134L675.148 1223.24Z" />
          <circle ref={ballRef} className={styles.ball} cx="159.5" cy="902.957" r="159.5" />
        </svg>
      ) : (
        <img
          src="/images/combination_mark.png"
          alt="Makinari Logo"
          className="h-5 w-auto object-contain dark:brightness-0 dark:invert"
        />
      )}
    </NavigationLink>
  )
}