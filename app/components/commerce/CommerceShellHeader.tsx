"use client"

import React, { useEffect, useRef, useState } from "react"
import { ExitDemoMode } from "./ExitDemoMode"

type Props = {
  brand: React.ReactNode
  center?: React.ReactNode
  actions: React.ReactNode
  mobileLeading?: React.ReactNode
  hideCenterOnMobile?: boolean
  /** When set, replaces brand/center/actions on mobile (e.g. expanded search). */
  mobileExpanded?: React.ReactNode
}

function HeaderColumns({
  brand,
  center,
  actions,
  mobileLeading,
  hideCenterOnMobile,
}: Omit<Props, "mobileExpanded">) {
  const actionsRef = useRef<HTMLDivElement>(null)
  const [sideWidth, setSideWidth] = useState<number | null>(null)

  useEffect(() => {
    // On small screens with a visible center, mirror the actions width onto the
    // brand column so the nav stays visually centered. Desktop uses natural
    // brand/actions widths so the center can claim all leftover space.
    if (hideCenterOnMobile) {
      setSideWidth(null)
      return
    }

    const el = actionsRef.current
    if (!el) return

    const mq = window.matchMedia("(min-width: 768px)")
    const measure = () => {
      if (mq.matches) {
        setSideWidth(null)
        return
      }
      const next = Math.ceil(el.getBoundingClientRect().width)
      setSideWidth((prev) => (prev === next ? prev : next))
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    mq.addEventListener("change", measure)
    return () => {
      observer.disconnect()
      mq.removeEventListener("change", measure)
    }
  }, [actions, hideCenterOnMobile])

  return (
    <>
      {/* Brand: content-sized on desktop; mirrored to actions width on mobile when center is shown. */}
      <div
        data-commerce-shell-brand
        className={`flex items-center justify-start gap-2 md:gap-4 relative z-10 min-w-0 shrink-0 overflow-hidden md:overflow-visible ${
          hideCenterOnMobile ? "flex-1 md:flex-none" : ""
        }`}
        style={
          !hideCenterOnMobile && sideWidth != null
            ? ({ ["--shell-side-width" as string]: `${sideWidth}px`, width: "var(--shell-side-width)" } as React.CSSProperties)
            : undefined
        }
      >
        {mobileLeading}
        {brand}
      </div>

      {/* Center: takes all space between brand and actions (no artificial max-width). */}
      <div
        className={`${
          hideCenterOnMobile ? "hidden md:flex" : "flex"
        } flex-1 min-w-0 justify-start md:justify-center px-1.5 md:px-4`}
      >
        {center ? (
          <div className="flex min-w-0 w-full max-w-full">
            {center}
          </div>
        ) : null}
      </div>

      <div
        ref={actionsRef}
        data-commerce-shell-actions
        className="flex items-center justify-end gap-2 md:gap-3 relative z-10 shrink-0"
      >
        {actions}
      </div>
    </>
  )
}

export function CommerceShellHeader({
  brand,
  center,
  actions,
  mobileLeading,
  hideCenterOnMobile = true,
  mobileExpanded,
}: Props) {
  return (
    <div className="sticky top-4 z-40 w-full mb-4 md:mb-8 shrink-0">
      <ExitDemoMode />
      <div className="px-4 md:px-8 w-full max-w-7xl mx-auto pointer-events-none">
        <header
          data-commerce-shell-header
          className="pointer-events-auto relative rounded-full border dark:border-white/10 border-black/5 bg-white/80 dark:bg-[#030303]/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-[#030303]/60 shadow-sm flex items-center px-3 md:px-6 py-2 w-full transition-all min-h-[56px] justify-between gap-1.5"
        >
          {mobileExpanded ? (
            <>
              <div className="flex md:hidden w-full items-center gap-2 min-w-0">
                {mobileExpanded}
              </div>
              <div className="hidden md:contents">
                <HeaderColumns
                  brand={brand}
                  center={center}
                  actions={actions}
                  mobileLeading={mobileLeading}
                  hideCenterOnMobile={hideCenterOnMobile}
                />
              </div>
            </>
          ) : (
            <HeaderColumns
              brand={brand}
              center={center}
              actions={actions}
              mobileLeading={mobileLeading}
              hideCenterOnMobile={hideCenterOnMobile}
            />
          )}
        </header>
      </div>
    </div>
  )
}

// Utility classes for children of CommerceShellHeader to match the pill style
export const shellClasses = {
  navItem: "inline-flex items-center gap-2 h-9 px-4 rounded-full font-inter text-sm font-medium leading-none transition-all whitespace-nowrap",
  navItemActive: "bg-black/5 dark:bg-white/10 text-slate-900 dark:text-white",
  navItemInactive:
    "text-slate-600 dark:text-white/70 bg-transparent transition-all duration-200 hover:text-slate-900 dark:hover:text-white hover:bg-black/15 dark:hover:bg-white/20 hover:backdrop-blur-md hover:shadow-sm",
  iconButton:
    "h-9 w-9 aspect-square shrink-0 p-0 !min-w-0 rounded-full font-inter inline-flex items-center justify-center text-slate-600 dark:text-white/70 !bg-transparent shadow-none border-0 transition-colors duration-200 hover:text-slate-900 dark:hover:text-white hover:!bg-black/10 dark:hover:!bg-white/15",
  primaryCta: "text-sm font-medium bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full font-inter font-bold hover:opacity-90 transition-opacity shadow-sm flex items-center whitespace-nowrap",
}
