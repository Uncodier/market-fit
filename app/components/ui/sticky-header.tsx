"use client"

import { cn } from "@/lib/utils"
import { ReactNode } from "react"
import { useLayout } from "@/app/context/LayoutContext"
import { BuildWithAIButton } from "./build-with-ai-button"
import { usePathname } from 'next/navigation'

interface StickyHeaderProps {
  children: ReactNode
  className?: string
  isLayoutCollapsed?: boolean
  showAIButton?: boolean
}

export function StickyHeader({ 
  children, 
  className, 
  isLayoutCollapsed: propIsLayoutCollapsed,
  showAIButton = true 
}: StickyHeaderProps) {
  const pathname = usePathname();
  const layoutContext = useLayout();
  
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
      "border-b border-border/40 z-10",
      isAgentsPage ? "top-[64px] min-h-[71px]" : "top-[64px] min-h-[71px]",
      className
    )}>
      <div className={cn(
        "sticky transition-all duration-200 ease-in-out",
        isCollapsed ? "left-[64px] w-[calc(100vw-64px)]" : "left-[256px] w-[calc(100vw-256px)]"
      )}>
        {children}
        {isLeadsDetailPage && showAIButton && (
          <div className="absolute right-16 top-1/2 transform -translate-y-1/2">
            <BuildWithAIButton 
              variant="secondary" 
              size="sm"
            />
          </div>
        )}
      </div>
    </div>
  )
} 