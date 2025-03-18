"use client"

import { cn } from "@/lib/utils"
import { ReactNode } from "react"
import { useLayout } from "@/app/context/LayoutContext"

interface StickyHeaderProps {
  children: ReactNode
  className?: string
  isLayoutCollapsed?: boolean
}

export function StickyHeader({ children, className, isLayoutCollapsed: propIsLayoutCollapsed }: StickyHeaderProps) {
  // Usar el contexto si está disponible, de lo contrario usar la prop
  let isCollapsed = propIsLayoutCollapsed;
  
  try {
    const layoutContext = useLayout();
    // Si el contexto está disponible, usarlo en lugar de la prop
    isCollapsed = layoutContext.isLayoutCollapsed;
  } catch (error) {
    // Si hay un error al usar el contexto (por ejemplo, si no está disponible),
    // seguimos usando el valor de la prop
    console.warn("LayoutContext no disponible, usando prop isLayoutCollapsed");
  }
  
  return (
    <div className={cn(
      "sticky top-16 min-h-[71px] flex items-center p-0",
      "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      "border-b border-border/40 z-10",
      className
    )}>
      <div className={cn(
        "sticky w-[calc(100vw-256px)]", 
        isCollapsed ? "left-[64px] w-[calc(100vw-64px)]" : "left-[256px] w-[calc(100vw-256px)]"
      )}>
        {children}
      </div>
    </div>
  )
} 