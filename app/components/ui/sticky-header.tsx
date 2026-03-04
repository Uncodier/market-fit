"use client"

import { cn } from "@/lib/utils"
import { ReactNode, useRef } from "react"
import { useLayout } from "@/app/context/LayoutContext"
import { usePathname } from 'next/navigation'
import { useCommandK } from "@/app/hooks/use-command-k"
import { useIsMobile } from "@/app/hooks/use-mobile-view"
import { Input } from "./input"
import { Search } from "./icons"

interface StickyHeaderProps {
  children: ReactNode
  className?: string
  isLayoutCollapsed?: boolean
  showSearch?: boolean
  onSearch?: (value: string) => void
  searchValue?: string
  searchPlaceholder?: string
}

export function StickyHeader({ 
  children, 
  className, 
  isLayoutCollapsed: propIsLayoutCollapsed,
  showSearch = false,
  onSearch,
  searchValue = "",
  searchPlaceholder = "Search..."
}: StickyHeaderProps) {
  const pathname = usePathname();
  const layoutContext = useLayout();
  const isMobile = useIsMobile();
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Use the command+k hook
  useCommandK();
  
  // Siempre usar el contexto si está disponible, de lo contrario usar la prop
  const isCollapsed = layoutContext?.isLayoutCollapsed ?? propIsLayoutCollapsed;
  
  // Use fixed positioning on robots/chat - parent has overflow-hidden which breaks sticky
  const useFixedPosition = pathname?.startsWith('/robots') || pathname?.startsWith('/chat');
  const sidebarLeft = isMobile ? 0 : (isCollapsed ? 64 : 256);
  
  return (
    <div
      data-toolbar-font
      className={cn(
      "flex items-center p-0",
      "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      "border-b dark:border-white/5 border-black/5 z-[150]",
      useFixedPosition ? "fixed transition-all duration-300 ease-in-out" : "sticky",
      "top-[64px] min-h-[71px]",
      className
    )}
    style={useFixedPosition ? { left: sidebarLeft, right: 0 } : undefined}
    >
      <div className={cn(
        "transition-[padding] duration-300 ease-in-out w-full flex items-center h-full max-w-full overflow-hidden",
        "px-4 lg:px-8"
      )}>
        <div className="flex-1 w-full max-w-full overflow-hidden h-full flex items-center justify-start">
          {showSearch && (
            <div className="relative w-64 mb-4">
              <Input
                ref={searchInputRef}
                type="text"
                placeholder={searchPlaceholder}
                className="w-full pl-8"
                value={searchValue}
                onChange={(e) => onSearch?.(e.target.value)}
                data-command-k-input
              />
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <kbd className="pointer-events-none absolute right-2 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  )
} 