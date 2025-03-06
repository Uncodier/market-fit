"use client"

import Link from "next/link"
import { ChevronRight } from "@/app/components/ui/icons"
import { cn } from "@/lib/utils"

interface Crumb {
  href: string
  label: string
  icon?: React.ReactNode
}

interface BreadcrumbProps {
  items: Crumb[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav 
      className={cn("flex items-center text-sm text-muted-foreground", className)}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center space-x-2">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          
          return (
            <li key={item.href} className="flex items-center">
              {i > 0 && (
                <ChevronRight className="mx-2 h-4 w-4 text-muted-foreground/50" aria-hidden={true} />
              )}
              
              {isLast ? (
                <span className="flex items-center font-medium text-foreground">
                  {item.icon && <span className="mr-1.5">{item.icon}</span>}
                  {item.label}
                </span>
              ) : (
                <Link 
                  href={item.href}
                  className="flex items-center hover:text-foreground transition-colors"
                >
                  {item.icon && <span className="mr-1.5">{item.icon}</span>}
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
} 