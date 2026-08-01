"use client"

import React from "react"
import { WorkspaceArea } from "@/app/config/navigation-areas"
import { getModuleVisual, ModulePattern } from "@/app/config/module-visuals"
import { AnimatedIcon } from "./AnimatedIcon"

interface ModuleTileProps {
  area: WorkspaceArea
  itemKey: string
  title: string
  icon: React.ComponentType<any>
  onClick: () => void
}

function PatternLayer({
  pattern,
  animated,
  orbs,
}: {
  pattern: ModulePattern
  animated: boolean
  orbs: { color1: string; color2: string; color3: string; color4: string }
}) {
  const motionClass = animated ? "motion-reduce:!animate-none animate-pulse-slow" : "![animation:none]"
  
  // Base configuration for mesh gradients
  // We use Framer Motion for the animated ones, static divs for the rest
  const renderMesh = (c1: string, c2: string, c3: string, c4: string) => {
    if (animated) {
      return (
        <div className="absolute inset-0 opacity-40" style={{ willChange: "transform, opacity" }}>
          <div
            className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full animate-orb-1"
            style={{ background: `radial-gradient(circle, ${c1} 0%, transparent 70%)` }}
          />
          <div
            className="absolute top-[-10%] right-[-30%] w-[90%] h-[90%] rounded-full animate-orb-2"
            style={{ background: `radial-gradient(circle, ${c2} 0%, transparent 70%)` }}
          />
          <div
            className="absolute bottom-[-30%] left-[-10%] w-[100%] h-[100%] rounded-full animate-orb-3"
            style={{ background: `radial-gradient(circle, ${c3} 0%, transparent 70%)` }}
          />
          <div
            className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full animate-orb-4"
            style={{ background: `radial-gradient(circle, ${c4} 0%, transparent 70%)` }}
          />
        </div>
      )
    }

    // Static versions based on pattern number
    const variants = {
      "mesh-1": [
        { top: "-20%", left: "-20%", w: "80%", h: "80%", c: c1 },
        { top: "-10%", right: "-30%", w: "90%", h: "90%", c: c2 },
        { bottom: "-30%", left: "-10%", w: "100%", h: "100%", c: c3 },
        { bottom: "-20%", right: "-20%", w: "80%", h: "80%", c: c4 },
      ],
      "mesh-2": [
        { top: "10%", left: "10%", w: "70%", h: "70%", c: c4 },
        { top: "-40%", right: "-10%", w: "100%", h: "100%", c: c1 },
        { bottom: "-20%", left: "-20%", w: "90%", h: "90%", c: c2 },
        { bottom: "-10%", right: "10%", w: "60%", h: "60%", c: c3 },
      ],
      "mesh-3": [
        { top: "-30%", left: "20%", w: "90%", h: "90%", c: c3 },
        { top: "20%", right: "-30%", w: "80%", h: "80%", c: c4 },
        { bottom: "-10%", left: "-30%", w: "100%", h: "100%", c: c1 },
        { bottom: "10%", right: "20%", w: "70%", h: "70%", c: c2 },
      ],
      "mesh-4": [
        { top: "0%", left: "-40%", w: "110%", h: "110%", c: c2 },
        { top: "-20%", right: "0%", w: "80%", h: "80%", c: c3 },
        { bottom: "-40%", left: "10%", w: "100%", h: "100%", c: c4 },
        { bottom: "0%", right: "-20%", w: "70%", h: "70%", c: c1 },
      ],
      "mesh-5": [
        { top: "-10%", left: "0%", w: "90%", h: "90%", c: c1 },
        { top: "10%", right: "-40%", w: "110%", h: "110%", c: c3 },
        { bottom: "0%", left: "-20%", w: "80%", h: "80%", c: c2 },
        { bottom: "-30%", right: "10%", w: "90%", h: "90%", c: c4 },
      ],
      "mesh-6": [
        { top: "-40%", left: "-20%", w: "120%", h: "120%", c: c4 },
        { top: "30%", right: "-10%", w: "70%", h: "70%", c: c1 },
        { bottom: "-20%", left: "30%", w: "80%", h: "80%", c: c3 },
        { bottom: "-10%", right: "-30%", w: "100%", h: "100%", c: c2 },
      ],
      "mesh-7": [
        { top: "20%", left: "-30%", w: "90%", h: "90%", c: c2 },
        { top: "-30%", right: "20%", w: "100%", h: "100%", c: c4 },
        { bottom: "10%", left: "-10%", w: "70%", h: "70%", c: c1 },
        { bottom: "-40%", right: "-10%", w: "110%", h: "110%", c: c3 },
      ],
    }

    const layout = variants[pattern as keyof typeof variants] || variants["mesh-1"]

    return (
      <div className="absolute inset-0 opacity-40" style={{ willChange: "transform, opacity" }}>
        {layout.map((pos, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              top: pos.top,
              left: pos.left,
              right: pos.right,
              bottom: pos.bottom,
              width: pos.w,
              height: pos.h,
              background: `radial-gradient(circle, ${pos.c} 0%, transparent 70%)`,
            }}
          />
        ))}
      </div>
    )
  }

  return renderMesh(orbs.color1, orbs.color2, orbs.color3, orbs.color4)
}

export function ModuleTile({ area, itemKey, title, icon: Icon, onClick }: ModuleTileProps) {
  const visual = getModuleVisual(area, itemKey)
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <div
      onClick={onClick}
      className="flex flex-col items-center gap-3 group outline-none w-[100px] cursor-pointer focus-visible:outline-none"
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
          "relative flex items-center justify-center w-16 h-16 rounded-2xl overflow-hidden",
          "border border-black/[0.06] dark:border-white/[0.08]",
          "transition-all duration-300 ease-out",
          "group-hover:-translate-y-0.5 group-focus-visible:-translate-y-0.5",
          visual.elevated ? "module-tile-elevated" : "module-tile-surface",
        ].join(" ")}
        style={
          {
            background: visual.gradient,
            "--module-shadow": visual.shadow,
            boxShadow: visual.elevated
              ? `0 10px 24px -6px var(--module-shadow), 0 4px 10px -2px rgba(0,0,0,0.12), inset 0 2px 2px rgba(255,255,255,0.4)`
              : `0 4px 12px -3px var(--module-shadow), inset 0 1px 1px rgba(255,255,255,0.3)`,
          } as React.CSSProperties
        }
      >
        {/* Depth wash / orbs */}
        <div
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ background: visual.wash }}
          aria-hidden
        />

        {/* Pattern — animated only for flagships; static motif for others */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-60" aria-hidden>
          <PatternLayer
            pattern={visual.pattern}
            animated={visual.animated}
            orbs={visual.meshOrbs}
          />
        </div>

        {/* Soft glass highlight (Skeumorphic Glare / Inner Bevel) */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none rounded-2xl"
          style={{
            background: `linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.05) 15%, transparent 40%, rgba(0,0,0,0.03) 80%, rgba(0,0,0,0.15) 100%)`,
            boxShadow: visual.elevated 
              ? `inset 0px 1.5px 1px rgba(255, 255, 255, 0.6), inset 0px -2px 3px rgba(0, 0, 0, 0.15)`
              : `inset 0px 1px 1px rgba(255, 255, 255, 0.5), inset 0px -1px 2px rgba(0, 0, 0, 0.1)`,
          }}
          aria-hidden
        />

        {/* Hover glow ring */}
        <div
          className="absolute inset-0 z-[2] rounded-2xl opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-300 pointer-events-none ring-1"
          style={{
            boxShadow: `inset 0 0 0 1px ${visual.accent}, 0 0 18px -4px ${visual.shadow}`,
            // ring color via boxShadow above
          }}
          aria-hidden
        />

        <div
          className="absolute inset-0 z-10 flex items-center justify-center drop-shadow-sm"
          style={{ color: visual.ink }}
        >
          <div
            className="flex items-center justify-center w-full h-full transition-transform duration-300 ease-out group-hover:scale-110 active:scale-95"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <AnimatedIcon icon={Icon} size={28} isHovered={isHovered} />
          </div>
        </div>
      </div>

      <div
        className={[
          "text-[11px] text-center leading-tight line-clamp-2 w-full px-1 transition-colors duration-200",
          visual.elevated
            ? "font-semibold text-foreground/80 group-hover:text-foreground"
            : "font-medium text-muted-foreground group-hover:text-foreground",
        ].join(" ")}
      >
        {title}
      </div>
    </div>
  )
}
