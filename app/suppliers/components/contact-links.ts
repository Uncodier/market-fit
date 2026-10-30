import { z } from "zod"
import type { SupplierContact } from "../schema"
import type { Company } from "@/app/companies/types"

export function contactLinks(contact: Pick<SupplierContact, "email" | "phone">) {
  const email = contact.email?.trim() || ""
  const phone = contact.phone?.trim() || ""
  const validPhone = /^\+?[\d\s().-]+$/.test(phone)
  const digits = phone.replace(/\D/g, "")
  return {
    email: z.string().email().safeParse(email).success ? `mailto:${encodeURIComponent(email)}` : null,
    call: validPhone && digits.length >= 7 && digits.length <= 15 ? `tel:${phone.startsWith("+") ? "+" : ""}${digits}` : null,
    whatsapp: validPhone && phone.startsWith("+") && digits.length >= 7 && digits.length <= 15 ? `https://wa.me/${digits}` : null,
  }
}

export function preferredSupplierContact(contacts: SupplierContact[], company?: Company | null) {
  const ordered = [...contacts.filter(contact => contact.is_primary), ...contacts.filter(contact => !contact.is_primary)]
  return {
    email: ordered.find(contact => contactLinks(contact).email)?.email || company?.email || "",
    phone: ordered.find(contact => contactLinks(contact).call)?.phone || company?.phone || "",
  }
}

export function safeCompanyUrl(value?: string | null) {
  if (!value?.trim()) return undefined
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) return undefined
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch { return undefined }
}