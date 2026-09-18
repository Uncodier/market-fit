"use client"

import React, { useState, Children, Fragment } from "react"
import { MoreVertical } from "@/app/components/ui/icons"
import { Button } from "@/app/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/app/components/ui/sheet"
import { useLocalization } from "@/app/context/LocalizationContext"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { cn } from "@/lib/utils"

export function FilterContainer({ children, className }: { children: React.ReactNode, className?: string }) {
  // To provide standard spacing and separators on mobile, we automatically inject FilterSeparator 
  // between the children elements.
  const arrayChildren = Children.toArray(children).filter(Boolean);
  
  return (
    <div className={cn("flex flex-col md:flex-row items-stretch md:items-center gap-6 md:gap-4 w-full flex-1 min-w-0", className)}>
      {arrayChildren.map((child, index) => {
        // We do not want to add a separator after the last item
        const isLast = index === arrayChildren.length - 1;
        // On desktop, the gap-4 handles spacing. On mobile, we use gap-6.
        // We will just render the child. If we wanted lines, we could insert them here.
        // But since the user explicitly wants structural visual improvements:
        return (
          <Fragment key={index}>
            {child}
            {!isLast && <div className="h-px bg-border md:hidden w-full opacity-50" />}
          </Fragment>
        )
      })}
    </div>
  )
}

export function FilterSection({
  children,
  title,
  helper,
  mobileOnly,
  desktopOnly,
  className
}: {
  children: React.ReactNode
  title?: string
  helper?: string
  mobileOnly?: boolean
  desktopOnly?: boolean
  className?: string
}) {
  return (
    <div className={cn(
      "flex flex-col gap-2.5 md:gap-0 w-full md:w-auto",
      mobileOnly && "md:hidden",
      desktopOnly && "max-md:hidden",
      className
    )}>
      {title && <span className="text-[11px] font-bold text-muted-foreground md:hidden uppercase tracking-wider">{title}</span>}
      {children}
      {helper && <p className="text-xs text-muted-foreground mt-1 md:hidden">{helper}</p>}
    </div>
  )
}

export function FilterSeparator({ className }: { className?: string }) {
  return <div className={cn("h-px bg-border md:hidden w-full", className)} />
}

interface MobileFiltersDrawerProps {
  children: React.ReactNode
  triggerText?: string
  results?: React.ReactNode
}

export function MobileFiltersDrawer({ children, triggerText, results }: MobileFiltersDrawerProps) {
  const { t } = useLocalization()
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  if (!isMobile) {
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {children}
      </div>
    )
  }

  return (
    <div className="flex shrink-0">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 rounded-full">
            <MoreVertical className="h-4 w-4" />
            <span className="sr-only">
              {triggerText || t('common.search') || "Search & Filters"}
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[85vw] sm:max-w-md p-0 flex flex-col bg-background">
          <SheetHeader className="px-4 py-4 border-b">
            <SheetTitle className="text-left font-semibold text-lg">{triggerText || t('common.search') || "Search"}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 mobile-filters-drawer-content">
            {children}
            {results && (
              <div className="mt-2 pt-6 border-t border-border flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">{t('common.results') || 'Results'}</h3>
                <div className="-mx-4 px-4 overflow-x-auto">
                  {results}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
