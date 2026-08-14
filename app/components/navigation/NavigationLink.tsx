"use client"

import Link from 'next/link'
import { forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  assignLocation,
  hrefToString,
  isClientRouterStale,
  navigateOrAssign,
  startNavigationWatchdog,
} from '@/lib/navigation/stale-router'
import { markUINavigation } from '@/app/hooks/use-navigation-history'

function isModifiedClick(event: React.MouseEvent<HTMLAnchorElement>): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0
}

/**
 * Enhanced Link component that marks navigation as UI-initiated
 */
export const NavigationLink = forwardRef<HTMLAnchorElement, React.ComponentProps<typeof Link>>(
  function NavigationLink({ href, children, onClick, prefetch = false, ...props }, ref) {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (isModifiedClick(e)) {
        markUINavigation()
        onClick?.(e)
        return
      }

      const hrefString = hrefToString(href)

      if (isClientRouterStale()) {
        e.preventDefault()
        onClick?.(e)
        assignLocation(hrefString)
        return
      }

      markUINavigation()
      onClick?.(e)
      if (!e.defaultPrevented) {
        startNavigationWatchdog(hrefString)
      }
    }
    
    return (
      <Link ref={ref} href={href} prefetch={prefetch} onClick={handleClick} {...props}>
        {children}
      </Link>
    )
  }
)

/**
 * Hook to wrap router.push with UI navigation marking
 */
export function useNavigationRouter() {
  const router = useRouter()
  
  return {
    ...router,
    push: (href: string) => {
      navigateOrAssign(router, href)
    },
    replace: (href: string) => {
      navigateOrAssign(router, href, { replace: true })
    }
  }
}
