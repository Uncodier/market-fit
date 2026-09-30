export const SUPPORT_SITE_ID = "9be0a6a2-5567-41bf-ad06-cb4014f0faf2"

export interface ChatIdentityContext {
  siteId: string
  sessionId: string
  visitorId: string
  sessionToken: string
}

export interface IdentitySdk {
  getIdentityContext(): Promise<ChatIdentityContext>
  identify(input: { identityToken: string }): Promise<{ status: string; expiresAt?: number }>
  logoutIdentity(): Promise<void>
}

declare global {
  interface Window {
    Makinari?: Partial<IdentitySdk> & {
      siteId?: string
      init?: (config: Record<string, unknown>) => void
      showWidget?: () => void
      hideWidget?: () => void
      widgetHide?: () => void
      openChatWithTask?: () => void
      setTheme?: (theme: string) => void
      chat?: { identify: (attributes: { name: string; email: string; phone?: string }) => Promise<unknown> }
    }
    MarketFit?: Window["Makinari"]
  }
}

export function getIdentitySdk(): IdentitySdk | undefined {
  if (typeof window === "undefined") return undefined
  const sdk = window.Makinari ?? window.MarketFit
  if (typeof sdk?.getIdentityContext !== "function" || typeof sdk.identify !== "function" || typeof sdk.logoutIdentity !== "function") {
    return undefined
  }
  return sdk as IdentitySdk
}