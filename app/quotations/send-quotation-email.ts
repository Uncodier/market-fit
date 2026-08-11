import {
  buildDocumentEmailHtml,
  buildDocumentEmailSubject,
  buildDocumentSendGridPayload,
  getSendGridConfig,
  sendDocumentEmailViaSendGrid,
  type SendDocumentEmailParams,
} from "@/app/documents/send-document-email"

export { getSendGridConfig }

export type SendQuotationEmailParams = Omit<SendDocumentEmailParams, "i18nPrefix" | "docRef" | "viewLink"> & {
  quoteRef: string
  buyerLink: string
}

export function buildQuotationEmailHtml(params: {
  toName?: string | null
  siteName: string
  quoteRef: string
  totalLabel: string
  buyerLink: string
  locale?: string | null
}): string {
  return buildDocumentEmailHtml({
    toName: params.toName,
    siteName: params.siteName,
    docRef: params.quoteRef,
    totalLabel: params.totalLabel,
    viewLink: params.buyerLink,
    locale: params.locale,
    i18nPrefix: "quotations",
  })
}

export function buildQuotationEmailSubject(params: {
  siteName: string
  quoteRef: string
  locale?: string | null
}): string {
  return buildDocumentEmailSubject({
    siteName: params.siteName,
    docRef: params.quoteRef,
    locale: params.locale,
    i18nPrefix: "quotations",
  })
}

export function buildSendGridMailPayload(params: SendQuotationEmailParams) {
  return buildDocumentSendGridPayload({
    ...params,
    docRef: params.quoteRef,
    viewLink: params.buyerLink,
    i18nPrefix: "quotations",
  })
}

export async function sendQuotationEmailViaSendGrid(
  params: SendQuotationEmailParams
): Promise<{ success: true } | { error: string }> {
  return sendDocumentEmailViaSendGrid({
    ...params,
    docRef: params.quoteRef,
    viewLink: params.buyerLink,
    i18nPrefix: "quotations",
  })
}
