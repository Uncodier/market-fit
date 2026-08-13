"use client"

import { useLocalization } from "@/app/context/LocalizationContext"
import { useState, useRef, useEffect } from "react"
import { SearchInput } from "@/app/components/ui/search-input"
import { ArrowLeft, Star } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import { useRouter } from "next/navigation"
import { NAVIGATION_AREAS, AreaNavItem, buildNavItemHref, getNavItemTitle, NAVIGATION_MENU_AREA_ORDER } from "@/app/config/navigation-areas"
import { AREA_ICON, NAV_ITEM_ICON, getAreaFamilyAccent } from "@/app/config/module-visuals"
import { ModuleTile } from "@/app/components/navigation/ModuleTile"
import { useSidebarNavKeys } from "@/app/components/navigation/use-sidebar-nav-keys"
import { cn } from "@/lib/utils"

interface NavigationPageProps {
  isOverlay?: boolean
  onClose?: () => void
}

export default function NavigationPage({ isOverlay, onClose }: NavigationPageProps) {
  const { t } = useLocalization()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const sidebarNavKeys = useSidebarNavKeys()

  useEffect(() => {
    // Only auto-focus on desktop to prevent mobile keyboard from popping up
    if (inputRef.current && window.innerWidth > 768) {
      inputRef.current.focus()
    }
  }, [])

  const buildHref = (item: AreaNavItem) => {
    return buildNavItemHref(item);
  }

  const getTitle = (item: AreaNavItem) => getNavItemTitle(item, t)

  const sectionsOrder = NAVIGATION_MENU_AREA_ORDER

  const handleBack = () => {
    if (onClose) {
      onClose()
    } else {
      router.back()
    }
  }

  const handleTileClick = (item: AreaNavItem) => {
    router.push(buildHref(item))
    if (onClose) {
      onClose()
    }
  }

  return (
    <div className={cn(
      "flex-1 min-w-0 w-full flex flex-col min-h-[100dvh]", 
      isOverlay ? "bg-transparent overflow-y-auto h-full" : "bg-muted/30"
    )}>
      <div className={cn(
        "flex-none flex flex-col justify-center h-[64px] sticky top-0 z-[200]",
        "border-b dark:border-white/5 border-black/5",
        isOverlay 
          ? "bg-background/60 backdrop-blur-3xl" 
          : "bg-background/70 backdrop-blur-sm"
      )}>
        <div className="flex h-[64px] items-center justify-between px-4 lg:px-8 w-full max-w-full">
          <div className="flex items-center flex-1 min-w-0">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleBack}
              className="gap-2 text-muted-foreground hover:text-foreground font-inter"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("common.back") === "common.back" ? "Back" : t("common.back")}
            </Button>
          </div>
          
          <div className="flex items-center justify-center flex-1 min-w-0">
            <SearchInput 
              ref={inputRef}
              data-command-k-input
              placeholder={t("common.search") === "common.search" ? "Search..." : t("common.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-full pr-14 bg-background border-border focus:border-muted-foreground/20 focus:ring-muted-foreground/20"
              containerClassName="w-[280px] lg:w-[400px]"
              alwaysExpanded={true}
            />
          </div>

          <div className="flex items-center justify-end flex-1 min-w-0">
          </div>
        </div>
      </div>
      <div className={cn("flex-1 px-4 lg:px-8 py-8 flex flex-col items-center w-full")}>
        <div className="flex flex-col gap-12 max-w-[1200px] w-full pb-12">
          {sectionsOrder.map((areaKey) => {
            const area = NAVIGATION_AREAS[areaKey]
            const items = area.items.filter(item => {
              if (item.hidden) return false
              const title = getTitle(item).toLowerCase()
              return title.includes(searchQuery.toLowerCase())
            })
            if (items.length === 0) return null

            const categoryTitle = t(area.categoryKey) === area.categoryKey ? areaKey : t(area.categoryKey)
            const areaAccent = getAreaFamilyAccent(areaKey)

            return (
              <div key={areaKey} className="flex flex-col gap-6">
                <div className="flex items-center gap-2.5 px-1">
                  <div
                    className="flex items-center justify-center w-8 h-8 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${areaAccent}33 0%, ${areaAccent}14 100%)`,
                      boxShadow: `0 2px 8px -2px ${areaAccent}40`,
                    }}
                  >
                    {(() => {
                      const Icon = AREA_ICON[areaKey]
                      return <Icon style={{ color: areaAccent }} size={18} />
                    })()}
                  </div>
                  <h2 className="text-lg font-semibold text-foreground capitalize tracking-tight">{categoryTitle}</h2>
                </div>
                <div className="flex flex-wrap gap-8">
                  {items.map((item) => {
                    const Icon = NAV_ITEM_ICON[item.key] || Star
                    return (
                      <ModuleTile
                        key={item.key}
                        area={areaKey}
                        itemKey={item.key}
                        title={getTitle(item)}
                        icon={Icon}
                        inMenu={sidebarNavKeys.has(item.key)}
                        onClick={() => handleTileClick(item)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
