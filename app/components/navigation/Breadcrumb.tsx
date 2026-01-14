"use client"

import { ChevronRight } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"
import { NavigationLink } from "./NavigationLink"

interface Crumb {
  href: string
  label: string
  icon?: React.ReactNode
}

interface BreadcrumbProps {
  items: Crumb[]
  className?: string
}

/**
 * Calculate font size based on position in breadcrumb
 * Last item is largest, previous items get progressively smaller
 */
function getFontSize(position: number, total: number): string {
  const isLast = position === total - 1
  
  if (isLast) return 'text-2xl'
  
  const fromEnd = total - position - 1
  const sizes = ['text-xl', 'text-lg', 'text-base', 'text-sm']
  
  return sizes[fromEnd - 1] || 'text-sm'
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  // Only show last 5 items
  const visibleItems = items.slice(-5)
  
  return (
    <nav 
      className={cn("flex items-center text-muted-foreground overflow-x-auto", className)}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center">
        {visibleItems.map((item, i) => {
          const isLast = i === visibleItems.length - 1
          const fontSize = getFontSize(i, visibleItems.length)
          
          return (
            <li key={`${item.href}-${i}`} className="flex items-center shrink-0">
              {i > 0 && (
                <ChevronRight 
                  className={cn(
                    "mx-1.5 text-muted-foreground/50 transition-all duration-200",
                    isLast ? "h-5 w-5" : "h-4 w-4"
                  )} 
                  aria-hidden={true} 
                />
              )}
              
              {isLast ? (
                <span 
                  className={cn(
                    "flex items-center font-semibold text-foreground transition-all duration-200",
                    fontSize
                  )}
                >
                  {item.icon && <span className="mr-1.5">{item.icon}</span>}
                  {item.label}
                </span>
              ) : (
                <NavigationLink 
                  href={item.href}
                  className={cn(
                    "flex items-center font-semibold text-muted-foreground hover:text-foreground transition-all duration-200",
                    fontSize
                  )}
                >
                  {item.icon && <span className="mr-1.5">{item.icon}</span>}
                  {item.label}
                </NavigationLink>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
} 