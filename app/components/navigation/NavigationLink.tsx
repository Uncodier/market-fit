"use client"

import Link from 'next/link'
import { forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  hrefToString,
  navigateOrAssign,
  startNavigationWatchdog,
  type RouterNavigationOptions,
} from '@/lib/navigation/stale-router'
import { markUINavigation } from '@/lib/navigation/navigation-helpers'

import { appendArtifactIfNeeded } from '@/lib/navigation/artifact-url'

/**
 * Enhanced Link component that marks navigation as UI-initiated
 */
export const NavigationLink = forwardRef<HTMLAnchorElement, React.ComponentProps<typeof Link>>(
  function NavigationLink({ href, as, children, onNavigate, prefetch = false, ...props }, ref) {
    const finalHref = typeof window !== 'undefined' ? appendArtifactIfNeeded(hrefToString(href)) : href
    const finalAs = as === undefined ? undefined : typeof window !== 'undefined' ? appendArtifactIfNeeded(hrefToString(as)) : as

    const handleNavigate: NonNullable<React.ComponentProps<typeof Link>["onNavigate"]> = (event) => {
      let prevented = false
      onNavigate?.({ preventDefault: () => { prevented = true; event.preventDefault() } })
      if (prevented) return
      markUINavigation()
      startNavigationWatchdog(hrefToString(finalAs ?? finalHref))
    }
    
    return (
      <Link ref={ref} href={finalHref} as={finalAs} prefetch={prefetch} onNavigate={handleNavigate} {...props} data-navigation-managed="true">
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
    push: (href: string, options?: RouterNavigationOptions) => {
      navigateOrAssign(router, href, options)
    },
    replace: (href: string, options?: RouterNavigationOptions) => {
      navigateOrAssign(router, href, { ...options, replace: true })
    }
  }
}
