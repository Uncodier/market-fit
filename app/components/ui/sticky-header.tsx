import { cn } from "@/lib/utils"
import { ReactNode } from "react"

interface StickyHeaderProps {
  children: ReactNode
  className?: string
}

export function StickyHeader({ children, className }: StickyHeaderProps) {
  return (
    <div className={cn(
      "sticky top-0 min-h-[71px] flex items-center p-0",
      "bg-[#fafafacf] backdrop-blur supports-[backdrop-filter]:bg-[#fafafacf]",
      "border-b border-[#bfbfbf2e] z-10",
      className
    )}>
      {children}
    </div>
  )
} 