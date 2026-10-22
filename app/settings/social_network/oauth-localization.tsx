"use client"

import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"

export type OAuthMessage = {
  key: string
  params?: Record<string, string | number>
} | { raw: string }

/** Translate known application errors without rewriting unknown provider diagnostics. */
export function oauthErrorMessage(value: string, fallbackKey: string): OAuthMessage {
  const keys: Record<string, string> = {
    "Failed to load available pages": "loadFailed",
    "Failed to finalize connection": "finalizeFailed",
    "Unauthorized": "unauthorized",
    "Internal server error": "serverError",
    "OAuth failed.": "failed",
    "Sign in required to sync the social account. Please open the app, sign in, and connect again.": "signInRequired",
  }
  if (!value) return { key: fallbackKey }
  return keys[value] ? { key: `public.oauth.${keys[value]}` } : { raw: value }
}

export const OAUTH_TECHNICAL_VALUES = {
  provider: "Outstand.so",
  providerDomain: "outstand.so",
  supportEmail: "contact@outstand.so",
  redirectPattern: "https://app.makinari.com/settings/social_network*",
  error: "Missing code or state parameter",
}

export function OAuthDiagnostics({ ourRedirectUri, copied, onCopy }: {
  ourRedirectUri: string | null
  copied: boolean
  onCopy: (text: string) => Promise<void>
}) {
  const { t } = useLocalization()
  const supportMessage = t("public.oauth.supportMessage", {
    error: OAUTH_TECHNICAL_VALUES.error,
    redirectUri: ourRedirectUri || "https://[your-domain]/api/social/callback/facebook",
    sessionQuery: "?session=", errorQuery: "?error=",
    callbackPath: ".../facebook/callback",
    providerCallback: "https://www.outstand.so/app/api/socials/facebook/callback",
    providerRedirectSetting: "Valid OAuth Redirect URIs", providerDomainSetting: "App Domains",
  })
  return (
    <div className="w-full text-left space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">
        {t("public.oauth.sendToSupport", { email: OAUTH_TECHNICAL_VALUES.supportEmail })}
      </p>
      <pre className="text-xs p-3 bg-muted rounded overflow-x-auto whitespace-pre-wrap font-inter">{supportMessage}</pre>
      <p className="text-xs text-muted-foreground">
        {t("public.oauth.tunnelAdvice", { domain: "app.makinari.com" })}{" "}
        <code className="text-[10px]">https://app.makinari.com/api/social/callback/facebook</code>.
        {" "}{t("public.oauth.orSet")}{" "}
        <code className="text-[10px]">NEXT_PUBLIC_FORCE_PRODUCTION_OAUTH_REDIRECT=true</code>{" "}
        {t("public.oauth.useFromLocalhost")}.
      </p>
      <Button variant="outline" size="sm" onClick={() => onCopy(supportMessage)}>
        {copied ? t("public.oauth.copied") : t("public.oauth.copy")}
      </Button>
    </div>
  )
}