"use client"

import { cn } from "@/lib/utils"
import { ReactNode, useRef } from "react"
import { useLayout } from "@/app/context/LayoutContext"
import { usePathname } from 'next/navigation'
import { useCommandK } from "@/app/hooks/use-command-k"
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
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Use the command+k hook
  useCommandK();
  
  // Siempre usar el contexto si está disponible, de lo contrario usar la prop
  const isCollapsed = layoutContext?.isLayoutCollapsed ?? propIsLayoutCollapsed;
  
  // Check if we're in the leads detail page
  const isLeadsDetailPage = pathname?.startsWith('/leads/') && pathname !== '/leads';
  
  // Check if we're in the agents page
  const isAgentsPage = pathname?.startsWith('/agents');
  
  return (
    <div className={cn(
      "sticky flex items-center p-0",
      "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      "border-b border-border z-60",
      isAgentsPage ? "top-[64px] min-h-[71px]" : "top-[64px] min-h-[71px]",
      className
    )}
    >
      <div className={cn(
        "sticky transition-all duration-200 ease-in-out w-full flex items-center",
        isCollapsed ? "left-[64px] w-[calc(100vw-64px)]" : "left-[256px] w-[calc(100vw-256px)]"
      )}>
        <div className="flex-1">
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