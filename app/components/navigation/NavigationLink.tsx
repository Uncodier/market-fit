"use client"

import Link from 'next/link'
import { forwardRef } from 'react'
import { markUINavigation } from '@/app/hooks/use-navigation-history'

/**
 * Enhanced Link component that marks navigation as UI-initiated
 */
export const NavigationLink = forwardRef<HTMLAnchorElement, React.ComponentProps<typeof Link>>(
  function NavigationLink({ href, children, onClick, ...props }, ref) {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Mark this as UI navigation
      markUINavigation()
      
      // Call original onClick if provided
      if (onClick) {
        onClick(e)
      }
    }
    
    return (
      <Link ref={ref} href={href} onClick={handleClick} {...props}>
        {children}
      </Link>
    )
  }
)

/**
 * Hook to wrap router.push with UI navigation marking
 */
export function useNavigationRouter() {
  const router = require('next/navigation').useRouter()
  
  return {
    ...router,
    push: (href: string, options?: any) => {
      markUINavigation()
      return router.push(href, options)
    },
    replace: (href: string, options?: any) => {
      markUINavigation()
      return router.replace(href, options)
    }
  }
}
