"use client"

import React from "react"
import { WorkspaceArea } from "@/app/config/navigation-areas"
import { getModuleVisual } from "@/app/config/module-visuals"
import { ModuleImage } from "./ModuleImage"

interface ModuleTileProps {
  area: WorkspaceArea
  itemKey: string
  title: string
  onClick: () => void
  /** True when this module is currently in the sidebar nav / shortcuts. */
  inMenu?: boolean
}

const ICON_PLATE =
  "rounded-[20px] p-[3px] border border-black/12 dark:border-white/14 bg-black/[0.05] dark:bg-white/[0.07]"

export function ModuleTile({
  area,
  itemKey,
  title,
  onClick,
  inMenu = false,
}: ModuleTileProps) {
  const visual = getModuleVisual(area, itemKey)
  const marked = inMenu

  return (
    <div
      id={`tour-app-${itemKey}`}
      onClick={onClick}
      className="group flex w-full min-w-0 cursor-pointer flex-col items-center outline-none focus-visible:outline-none md:w-[112px]"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <div
        className={[
          "flex flex-col items-center gap-3 w-full transition-all duration-300 ease-out",
          "group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5",
          "rounded-[22px] border px-1 pb-2.5 pt-2 md:px-2",
          marked
            ? "border-black/12 dark:border-white/14 bg-black/[0.05] dark:bg-white/[0.07]"
            : "border-transparent bg-transparent",
        ].join(" ")}
      >
        <div className={ICON_PLATE}>
          <div
            className={[
              "relative flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden",
              "border border-black/[0.06] dark:border-white/[0.08]",
              marked ? "module-tile-elevated" : "module-tile-surface",
            ].join(" ")}
            style={
              {
                background: visual.gradient,
                "--module-shadow": visual.shadow,
                boxShadow: marked
                  ? `0 10px 24px -6px var(--module-shadow), 0 4px 10px -2px rgba(0,0,0,0.12), inset 0 2px 2px rgba(255,255,255,0.4)`
                  : `0 4px 12px -3px var(--module-shadow), inset 0 1px 1px rgba(255,255,255,0.3)`,
              } as React.CSSProperties
            }
          >
            <ModuleImage
              area={area}
              itemKey={itemKey}
              title={title}
              className="absolute inset-0 rounded-[15px]"
              imageClassName="transition-transform duration-300 ease-out group-hover:scale-105 group-focus-visible:scale-105"
            />

            <div
              className="absolute inset-0 z-[2] rounded-[15px] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 pointer-events-none ring-1"
              style={{
                boxShadow: `inset 0 0 0 1px ${visual.accent}, 0 0 18px -4px ${visual.shadow}`,
              }}
              aria-hidden
            />
          </div>
        </div>

        <div
          className={[
            "text-[11px] text-center leading-tight line-clamp-2 w-full px-1 transition-colors duration-200",
            marked
              ? "font-semibold text-foreground/80 group-hover:text-foreground"
              : "font-medium text-muted-foreground group-hover:text-foreground",
          ].join(" ")}
        >
          {title}
        </div>
      </div>
    </div>
  )
}
