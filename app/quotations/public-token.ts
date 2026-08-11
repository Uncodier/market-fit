import {
  buildPublicDocPath,
  buildPublicDocUrl,
  generatePublicAccessToken,
  isValidPublicAccessToken,
} from "@/app/documents/public-token"

/** URL-safe unguessable token for public quote links. */
export function generateQuotationPublicToken(): string {
  return generatePublicAccessToken()
}

export function isValidQuotationPublicToken(token: string | null | undefined): boolean {
  return isValidPublicAccessToken(token)
}

export function buildPublicQuotePath(token: string): string {
  return buildPublicDocPath("q", token)
}

export function buildPublicQuoteUrl(token: string, appUrl?: string): string {
  return buildPublicDocUrl("q", token, appUrl)
}
