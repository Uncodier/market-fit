import { documentT, resolveDocumentLocale } from "@/app/lib/i18n/document-t"

export type DocumentEmailI18nPrefix = "quotations" | "sales" | "orders" | "bills"

export type SendDocumentEmailParams = {
  toEmail: string
  toName?: string | null
  fromEmail: string
  fromName: string
  subject: string
  siteName: string
  docRef: string
  totalLabel: string
  viewLink: string
  pdfBase64: string
  pdfFilename: string
  apiKey: string
  locale?: string | null
  i18nPrefix: DocumentEmailI18nPrefix
}

export function getSendGridConfig(): {
  apiKey: string
  fromEmail: string
  fromName?: string
} | null {
  const apiKey = process.env.SENDGRID_API_KEY
  const fromEmail = process.env.SENDGRID_FROM_EMAIL
  if (!apiKey || !fromEmail) return null
  return {
    apiKey,
    fromEmail,
    fromName: process.env.SENDGRID_FROM_NAME || undefined,
  }
}

export function buildDocumentEmailHtml(params: {
  toName?: string | null
  siteName: string
  docRef: string
  totalLabel: string
  viewLink: string
  locale?: string | null
  i18nPrefix: DocumentEmailI18nPrefix
}): string {
  const locale = resolveDocumentLocale(params.locale)
  const p = params.i18nPrefix
  const greeting = params.toName
    ? documentT(locale, `${p}.email.greetingNamed`, { name: params.toName })
    : documentT(locale, `${p}.email.greeting`)
  const body = documentT(locale, `${p}.email.body`, {
    siteName: params.siteName,
    docRef: params.docRef,
    quoteRef: params.docRef,
    totalLabel: params.totalLabel,
  })
  const pdfNote = documentT(locale, `${p}.email.pdfAttached`)
  const cta = documentT(locale, `${p}.email.viewCta`)
  const orOpen = documentT(locale, `${p}.email.orOpen`, { link: params.viewLink })

  return `<!DOCTYPE html>
<html lang="${locale}">
<body style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif; color: #111; line-height: 1.5;">
  <p>${greeting}</p>
  <p>${body}</p>
  <p>${pdfNote}</p>
  <p><a href="${params.viewLink}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;">${cta}</a></p>
  <p style="color:#666;font-size:13px;">${orOpen}</p>
</body>
</html>`
}

export function buildDocumentEmailSubject(params: {
  siteName: string
  docRef: string
  locale?: string | null
  i18nPrefix: DocumentEmailI18nPrefix
}): string {
  return documentT(resolveDocumentLocale(params.locale), `${params.i18nPrefix}.email.subject`, {
    docRef: params.docRef,
    quoteRef: params.docRef,
    siteName: params.siteName,
  })
}

export function buildDocumentSendGridPayload(params: SendDocumentEmailParams) {
  const locale = resolveDocumentLocale(params.locale)
  const p = params.i18nPrefix
  const html = buildDocumentEmailHtml({
    toName: params.toName,
    siteName: params.siteName,
    docRef: params.docRef,
    totalLabel: params.totalLabel,
    viewLink: params.viewLink,
    locale,
    i18nPrefix: p,
  })
  const greeting = params.toName
    ? documentT(locale, `${p}.email.greetingNamed`, { name: params.toName })
    : documentT(locale, `${p}.email.greeting`)
  const text = [
    greeting,
    "",
    documentT(locale, `${p}.email.textBody`, {
      siteName: params.siteName,
      docRef: params.docRef,
      quoteRef: params.docRef,
      totalLabel: params.totalLabel,
    }),
    documentT(locale, `${p}.email.textPdfAttached`),
    documentT(locale, `${p}.email.textReview`, { link: params.viewLink }),
  ].join("\n")

  return {
    personalizations: [
      {
        to: [{ email: params.toEmail, ...(params.toName ? { name: params.toName } : {}) }],
      },
    ],
    from: { email: params.fromEmail, name: params.fromName },
    subject: params.subject,
    content: [
      { type: "text/plain", value: text },
      { type: "text/html", value: html },
    ],
    attachments: [
      {
        content: params.pdfBase64,
        filename: params.pdfFilename,
        type: "application/pdf",
        disposition: "attachment",
      },
    ],
  }
}

export async function sendDocumentEmailViaSendGrid(
  params: SendDocumentEmailParams
): Promise<{ success: true } | { error: string }> {
  const payload = buildDocumentSendGridPayload(params)
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    return {
      error: `Failed to send email (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`,
    }
  }

  return { success: true }
}
