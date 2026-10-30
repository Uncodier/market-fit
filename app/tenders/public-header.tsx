'use client'

import { useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { CommerceShellHeader, shellClasses } from '@/app/components/commerce/CommerceShellHeader'
import { CommerceSearchInput } from '@/app/components/commerce/CommerceSearchInput'
import { MobileShellSearchExpanded, MobileShellSearchIconButton } from '@/app/components/commerce/MobileShellSearch'
import { useCommerceSignInHref } from '@/app/components/commerce/use-commerce-sign-in-href'
import { useAuthContext } from '@/app/components/auth/auth-provider'
import { User } from '@/app/components/ui/icons'
import { Button } from '@/app/components/ui/button'
import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'
import { LocaleSelector } from '@/app/components/commerce/LocaleSelector'

type Props = { siteSlug?: string; search?: string; primaryActions?: ReactNode }

/** MarketplaceHeader/ShopHeader presentation, without their purchasing state. */
export function TenderHeader({ siteSlug, search = '', primaryActions }: Props) {
  const { t } = useProcurementI18n()
  const [query, setQuery] = useState(search)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const { user, isLoading } = useAuthContext()
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
  const { href: signInHref, onClick: onSignInClick } = useCommerceSignInHref()
  const base = siteSlug ? `/tenders/${siteSlug}` : '/tenders'
  const closeSearch = (open: boolean) => {
    setMobileSearchOpen(open)
    if (!open) {
      if (query !== search) router.push(`${base}?search=${encodeURIComponent(query.slice(0, 200))}`)
      requestAnimationFrame(() => trigger.current?.focus())
    }
  }
  return <>
    <div className="h-4 w-full shrink-0" />
    <CommerceShellHeader hideCenterOnMobile
      mobileExpanded={mobileSearchOpen ? <form action={base} role="search" className="flex w-full items-center gap-2 min-w-0">
        <input type="hidden" name="search" value={query.slice(0, 200)} />
        <MobileShellSearchExpanded value={query} onChange={value => setQuery(value.slice(0, 200))} placeholder={t('procurement.portal.public.search')} open={mobileSearchOpen} onOpenChange={closeSearch} />
      </form> : undefined}
      brand={<Link href="/marketplace" data-toolbar-font aria-label={t('procurement.portal.public.brandLabel')} className="shrink-0 flex items-center hover:opacity-80 transition-opacity">
        <Image src="/images/logo.png" alt="Makinari" width={24} height={24} className="h-6 w-6 object-contain dark:brightness-0 dark:invert md:hidden" />
        <span className="hidden md:inline text-xl font-black tracking-tight text-primary lowercase">{t('procurement.portal.public.tenders')}</span>
      </Link>}
      center={<form action={base} role="search" className="hidden md:block absolute left-1/2 top-1/2 z-[15] w-2/5 -translate-x-1/2 -translate-y-1/2">
        <CommerceSearchInput name="search" aria-label={t('procurement.portal.public.search')} placeholder={t('procurement.portal.public.search')} maxLength={200} value={query} onChange={setQuery} />
      </form>}
      actions={<div className="flex items-center justify-end gap-1 md:gap-3 min-w-0">
        <MobileShellSearchIconButton ref={trigger} value={query} label={t('procurement.portal.public.search')} onOpen={() => setMobileSearchOpen(true)} />
        <div data-commerce-shell-actions-core className="flex items-center justify-end gap-2 min-w-0">
          {user && <Link href="/home/submissions" className={`hidden lg:inline-flex ${shellClasses.navItem} ${shellClasses.navItemInactive}`}>{t('procurement.portal.public.mySubmissions')}</Link>}
          {primaryActions && <div data-commerce-page-primary-actions>{primaryActions}</div>}
          {!isLoading && (user ? <Link href="/home" aria-label={t('procurement.portal.public.myAccount')} className="hover:opacity-80 transition-opacity shrink-0">
            {avatarUrl ? <Image src={avatarUrl} alt={t('procurement.portal.public.myAccount')} width={32} height={32} unoptimized className="w-8 h-8 min-w-8 rounded-full object-cover border border-border shadow-sm shrink-0" />
              : <span className="w-8 h-8 min-w-8 rounded-full bg-muted flex items-center justify-center border border-border shadow-sm"><User className="w-4 h-4 text-muted-foreground" /></span>}
          </Link> : <>
            <Link href={signInHref} onClick={onSignInClick} className={`md:hidden ${shellClasses.iconButton}`} aria-label={t('procurement.portal.public.signIn')}><User className="h-4 w-4" /></Link>
            <div className="hidden md:inline-flex"><Button asChild variant={primaryActions ? 'ghost' : 'default'} className="h-9 !min-w-0 px-[15px] py-[7px] font-bold"><Link href={signInHref} onClick={onSignInClick}>{t('procurement.portal.public.signIn')}</Link></Button></div>
          </>)}
        </div>
      </div>} />
  </>
}

export function TenderFooter() {
  const { t } = useProcurementI18n()
  return <footer className="mt-auto border-t border-border/50 py-8">
    <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 md:px-8 text-sm text-muted-foreground">
      <p>{t('procurement.portal.public.footer')}</p>
      <div className="flex flex-wrap items-center gap-4"><nav aria-label={t('procurement.portal.public.commerceNavigation')} className="flex flex-wrap gap-4"><Link href="/marketplace">{t('procurement.portal.public.marketplace')}</Link><Link href="/tenders">{t('procurement.portal.public.allTenders')}</Link><Link href="/home/submissions">{t('procurement.portal.public.mySubmissions')}</Link></nav><LocaleSelector className="rounded-full" /></div>
    </div>
  </footer>
}