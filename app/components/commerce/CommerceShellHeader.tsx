import React from "react"

type Props = {
  brand: React.ReactNode
  center?: React.ReactNode
  actions: React.ReactNode
  mobileLeading?: React.ReactNode
  hideCenterOnMobile?: boolean
}

export function CommerceShellHeader({ brand, center, actions, mobileLeading, hideCenterOnMobile = true }: Props) {
  return (
    <div className="sticky top-4 z-40 w-full mb-8 shrink-0 transform-gpu" style={{ WebkitTransform: 'translate3d(0,0,0)', willChange: 'transform' }}>
      <div className="px-4 w-full max-w-7xl mx-auto pointer-events-none">
        <header className="pointer-events-auto relative rounded-full border dark:border-white/10 border-black/5 bg-white/80 dark:bg-[#030303]/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-[#030303]/60 shadow-sm flex items-center justify-between px-3 md:px-6 py-2 w-full gap-2 md:gap-4 transition-all min-h-[56px]">
          <div className="flex items-center gap-2 md:gap-4 relative z-10 flex-1 min-w-0">
            {mobileLeading}
            {brand}
          </div>
          
          {center && (
            <div className={`${hideCenterOnMobile ? 'hidden md:flex' : 'flex'} flex-[1_1_auto] md:flex-[2_1_auto] justify-center relative z-0 min-w-0 px-2 md:px-4`}>
              {center}
            </div>
          )}

          <div className="flex items-center justify-end gap-1 md:gap-3 relative z-10 flex-1 min-w-0 ml-auto">
            {actions}
          </div>
        </header>
      </div>
    </div>
  )
}

// Utility classes for children of CommerceShellHeader to match the pill style
export const shellClasses = {
  navItem: "inline-flex items-center gap-2 h-9 px-4 rounded-full font-inter text-sm font-medium leading-none transition-all",
  navItemActive: "bg-black/5 dark:bg-white/10 text-slate-900 dark:text-white",
  navItemInactive: "text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5",
  iconButton: "p-2 rounded-full font-inter flex items-center justify-center transition-all text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5",
  primaryCta: "text-sm font-medium bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-full font-inter font-bold hover:opacity-90 transition-opacity shadow-sm flex items-center",
}
