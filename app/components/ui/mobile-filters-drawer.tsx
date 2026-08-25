"use client"

import React, { useState } from "react"
import { Search } from "@/app/components/ui/icons"
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
            <Search className="h-4 w-4" />
            <span className="sr-only">
              {triggerText || t('common.search') || "Search & Filters"}
            </span>
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[85vw] sm:max-w-md p-0 flex flex-col bg-background">
          <SheetHeader className="px-4 py-4 border-b">
            <SheetTitle className="text-left font-semibold text-lg">{triggerText || t('common.search') || "Buscar"}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 mobile-filters-drawer-content">
            {children}
            {results && (
              <div className="mt-2 pt-6 border-t border-border flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">{t('common.results') || 'Resultados'}</h3>
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
