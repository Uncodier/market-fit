"use client"

import { useProcurementI18n } from '@/app/purchases/procurement/i18n/use-procurement-i18n'

import { Button } from "@/app/components/ui/button"
import { Mail, Phone, MessageSquare } from "@/app/components/ui/icons"
import { contactLinks } from "./contact-links"

export function SupplierContactActions({ email, phone }: { email: string; phone: string }) {
  const { t } = useProcurementI18n()
  const links = contactLinks({ email, phone })
  return <div className="flex flex-wrap items-center gap-1" aria-label={t('procurement.surfaces.suppliers.contact')}>
    {[
      { label: t('procurement.quoteDetail.email'), href: links.email, Icon: Mail },
      { label: t('procurement.surfaces.suppliers.call'), href: links.call, Icon: Phone },
      { label: "WhatsApp", href: links.whatsapp, Icon: MessageSquare },
    ].map(({ label, href, Icon }) => href ? <Button key={label} asChild variant="ghost" size="sm" className="h-8">
      <a href={href} target={href === links.whatsapp ? "_blank" : undefined} rel={href === links.whatsapp ? "noopener noreferrer" : undefined}>
        <Icon className="mr-1.5 h-3.5 w-3.5" />{label}
      </a>
    </Button> : <Button key={label} type="button" variant="ghost" size="sm" className="h-8" disabled title={t(Icon === Mail ? 'procurement.surfaces.suppliers.noEmail' : 'procurement.surfaces.suppliers.noPhone')}>
      <Icon className="mr-1.5 h-3.5 w-3.5" />{label}
    </Button>)}
  </div>
}