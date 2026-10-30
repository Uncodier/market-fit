"use client"

import { Button } from "@/app/components/ui/button"
import { Mail, Phone, MessageSquare } from "@/app/components/ui/icons"
import { contactLinks } from "./contact-links"

export function SupplierContactActions({ email, phone }: { email: string; phone: string }) {
  const links = contactLinks({ email, phone })
  return <div className="flex flex-wrap items-center gap-1" aria-label="Contact supplier">
    {[
      { label: "Email", href: links.email, Icon: Mail },
      { label: "Call", href: links.call, Icon: Phone },
      { label: "WhatsApp", href: links.whatsapp, Icon: MessageSquare },
    ].map(({ label, href, Icon }) => href ? <Button key={label} asChild variant="ghost" size="sm" className="h-8">
      <a href={href} target={label === "WhatsApp" ? "_blank" : undefined} rel={label === "WhatsApp" ? "noopener noreferrer" : undefined}>
        <Icon className="mr-1.5 h-3.5 w-3.5" />{label}
      </a>
    </Button> : <Button key={label} type="button" variant="ghost" size="sm" className="h-8" disabled title={`No valid ${label === "Email" ? "email address" : "phone number"} available`}>
      <Icon className="mr-1.5 h-3.5 w-3.5" />{label}
    </Button>)}
  </div>
}