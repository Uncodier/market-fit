import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface StickyHeaderProps {
  children: ReactNode
  className?: string
}

export function StickyHeader({ children, className }: StickyHeaderProps) {
  return (
    <div className={cn(
      "sticky top-16 min-h-[71px] flex items-center p-0",
      "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/80",
      "border-b border-border/40 z-10",
      className
    )}>
      {children}
    </div>
  )
} 