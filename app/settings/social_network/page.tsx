"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useSite } from "@/app/context/SiteContext"
import { getSocialAccountLimit, countSocialAccounts, canConnectSocialAccount } from "@/lib/billing-limits"
import { effectiveBillingPlan } from "@/lib/billing/startup-trial"
import { useBillingLimit } from "@/app/context/BillingLimitContext"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "@/app/components/ui/button"
import { CheckCircle, XCircle } from "@/app/components/ui/icons"
import { SettingsSelectionLoading } from '@/app/components/settings/settings-loading'
import { Checkbox } from "@/app/components/ui/checkbox"
import { useLocalization } from "@/app/context/LocalizationContext"
import { OAuthDiagnostics, OAUTH_TECHNICAL_VALUES, oauthErrorMessage, type OAuthMessage } from "./oauth-localization"

interface AvailablePage {
  id: string
  name: string
  username?: string
  profile_picture_url?: string
  accountType?: string
}

export default function SocialNetworkCallbackPage() {
  const { t } = useLocalization()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { currentSite } = useSite()
  const { showBillingLimit, showBillingLimitFromError } = useBillingLimit()
  const [status, setStatus] = useState<"loading" | "selecting" | "success" | "error">("loading")
  const [messageSource, setMessage] = useState<OAuthMessage>({ raw: "" })
  const message = "raw" in messageSource ? messageSource.raw : t(messageSource.key, messageSource.params)
  const [availablePages, setAvailablePages] = useState<AvailablePage[]>([])
  const [selectedPages, setSelectedPages] = useState<string[]>([])
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const [isFinalizing, setIsFinalizing] = useState(false)
  
  const siteId = searchParams.get("siteId")
  const network = searchParams.get("network")
  const session = searchParams.get("session")
  const error = searchParams.get("error")
  const returnTo = searchParams.get("returnTo")
  const ourRedirectUri = searchParams.get("our_redirect_uri")
  const outstandError = searchParams.get("outstand_error")
  const [copied, setCopied] = useState(false)

  // Strip Facebook's #_=_ from the URL. Facebook appends it to OAuth redirects and it can
  // cause hashchange quirks or prefetch/navigation side effects that lead to losing the session.
  useEffect(() => {
    const h = typeof window !== "undefined" ? window.location.hash : ""
    if (h === "#_=_" || h === "#_=") {
      history.replaceState(null, "", window.location.pathname + window.location.search)
    }
  }, [])

  // Fetch available pages when we have a session token
  useEffect(() => {
    // Log all URL parameters for debugging
    console.log('[Social Network Callback] URL params:', {
      siteId,
      network,
      session: session ? `present: ${session.substring(0, 20)}...` : 'missing',
      error,
      returnTo,
      currentUrl: window.location.href,
      allParams: Object.fromEntries(searchParams.entries()),
      note: error ? 'Outstand.so redirected with error instead of session token' : 'Waiting for session token from outstand.so'
    })

    if (!session) {
      // Check if there's an error from OAuth
      if (error) {
        setStatus("error")
        
        if (error === "Missing code or state parameter") {
          setMessage({ key: "public.oauth.callbackFailed", params: OAUTH_TECHNICAL_VALUES })
        } else if (error === "access_denied") {
          setMessage({ key: "public.oauth.cancelled" })
        } else if (error === "oauth_failed") {
          setMessage(oauthErrorMessage(searchParams.get("error_description") || "", "public.oauth.failed"))
        } else {
          setMessage({ key: "public.oauth.authenticationFailed", params: { error } })
        }
        return
      }

      // Check for other error indicators
      const errorDescription = searchParams.get("error_description")
      if (errorDescription) {
        setStatus("error")
        setMessage({ key: "public.oauth.authenticationFailed", params: { error: errorDescription } })
        return
      }

      // No session token - might be initial load or incomplete callback
      console.warn('[Social Network Callback] No session token and no error - this should not happen in normal flow')
      setStatus("loading")
      setMessage({ key: "public.oauth.waiting" })
      
      setTimeout(() => {
        const redirectUrl = returnTo 
          ? `${returnTo}/settings?tab=social` 
          : `/settings?tab=social`
        console.log('[Social Network Callback] Redirecting back to settings:', redirectUrl)
        router.push(redirectUrl)
      }, 3000)
      return
    }

    // We have a session token - fetch available pages
    const fetchAvailablePages = async () => {
      try {
        setStatus("loading")
        setMessage({ key: "public.oauth.loadingPages" })
        
        const response = await fetch(`/api/social/accounts/pending/${encodeURIComponent(session)}`)
        const result = await response.json()
        
        if (result.success && result.data) {
          const pages = result.data.availablePages || result.data.pages || []
          setAvailablePages(pages)
          
          if (pages.length === 0) {
            setStatus("error")
            setMessage({ key: "public.oauth.noPages" })
          } else {
            setStatus("selecting")
            setMessage({ key: "public.oauth.selectPages", params: { network: network || "" } })
            // Pre-select all pages by default
            setSelectedPages(pages.map((p: AvailablePage) => p.id))
          }
        } else {
          throw new Error(result.error || "Failed to load available pages")
        }
      } catch (error) {
        console.error("Error fetching available pages:", error)
        setStatus("error")
        setMessage(oauthErrorMessage(error instanceof Error ? error.message : "", "public.oauth.loadFailed"))
      }
    }

    fetchAvailablePages()
  }, [session, error, network, returnTo, router, searchParams])

  const handleTogglePage = (pageId: string) => {
    setSelectedPages(prev => 
      prev.includes(pageId)
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId]
    )
  }

  const handleFinalize = async () => {
    if (selectedPages.length === 0) {
      setMessage({ key: "public.oauth.selectAtLeastOne" })
      return
    }

    const limit = getSocialAccountLimit(effectiveBillingPlan(currentSite?.billing)) + (currentSite?.billing?.addons_count || 0)
    const currentCount = countSocialAccounts(currentSite)
    
    if (!canConnectSocialAccount(currentSite, selectedPages.length)) {
      showBillingLimit({
        kind: "accounts",
        current: currentCount + selectedPages.length,
        limit,
      })
      return
    }

    try {
      setIsFinalizing(true)
      setMessage({ key: "public.oauth.connectingPages" })
      
      const response = await fetch(`/api/social/accounts/pending/${encodeURIComponent(session || "")}/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          accountIds: selectedPages, 
          selectedPageIds: selectedPages,
          siteId: currentSite?.id,
          network
        }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        setStatus("success")
        setMessage({ key: "public.oauth.connected", params: { count: selectedPages.length } })
        
        // Full navigation so SiteContext reloads social_media from the DB.
        // router.push keeps the in-memory site, and refreshSites is a no-op on /settings.
        setTimeout(() => {
          const params = new URLSearchParams({ tab: "social", oauth_connected: "1" })
          if (currentSite?.id) params.set("oauth_site", currentSite.id)
          if (network) params.set("oauth_network", network)
          const path = `/settings?${params.toString()}`
          window.location.assign(returnTo ? `${returnTo}${path}` : path)
        }, 2000)
      } else {
        if (showBillingLimitFromError(result) || showBillingLimitFromError(result.error)) {
          return
        }
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : result.error?.message || "Failed to finalize connection"
        )
      }
    } catch (error) {
      console.error("Error finalizing connection:", error)
      if (showBillingLimitFromError(error)) {
        return
      }
      setStatus("error")
      setMessage(oauthErrorMessage(error instanceof Error ? error.message : "", "public.oauth.finalizeFailed"))
    } finally {
      setIsFinalizing(false)
    }
  }

  const handleBackToSettings = () => {
    const redirectUrl = returnTo 
      ? `${returnTo}/settings?tab=social` 
      : `/settings?tab=social`
    router.push(redirectUrl)
  }

  const title = network
    ? t("public.oauth.networkTitle", { network: network.charAt(0).toUpperCase() + network.slice(1) })
    : t("public.oauth.title")

  return (
    <div className="flex-1">
      <div className="py-8 pb-16 mt-4">
        <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
          <div className="flex-1 max-w-[880px] px-4 md:px-16">
            <SectionCard>
              <SectionCardHeader>
                <SectionCardTitle>{title}</SectionCardTitle>
                {status === "selecting" && message && (
                  <SectionCardDescription>{message}</SectionCardDescription>
                )}
              </SectionCardHeader>
              <SectionCardContent>
                {status === "loading" && (
                  <SettingsSelectionLoading label={message || t("public.oauth.processing")} />
                )}

                {status === "selecting" && (
                  <div className="space-y-3">
                    {availablePages.map((page) => (
                      <div
                        key={page.id}
                        className="flex items-center gap-4 w-full p-4 bg-muted/20 rounded-lg border dark:border-white/5 border-black/5 hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleTogglePage(page.id)}
                      >
                  <Checkbox
                    aria-label={t("public.oauth.selectPage", { name: page.name })}
                    checked={selectedPages.includes(page.id)}
                    onCheckedChange={() => handleTogglePage(page.id)}
                  />
                  {page.profile_picture_url && !imageErrors[page.id] && (
                    <img
                      src={page.profile_picture_url}
                      alt={page.name}
                      className="w-12 h-12 rounded-full font-inter flex-shrink-0 border dark:border-white/5 border-black/5"
                      onError={() => setImageErrors(prev => ({ ...prev, [page.id]: true }))}
                    />
                  )}
                  {(!page.profile_picture_url || imageErrors[page.id]) && (
                    <div className="w-12 h-12 rounded-full font-inter font-bold bg-muted flex items-center justify-center flex-shrink-0 border dark:border-white/5 border-black/5 text-muted-foreground uppercase">
                      {page.name?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium truncate">{page.name}</p>
                    {page.username && (
                      <p className="text-xs text-muted-foreground truncate">{page.username}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-sm font-medium text-center">{message}</p>
              <p className="text-xs text-muted-foreground text-center">
                {t("public.oauth.redirecting")}
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <XCircle className="h-12 w-12 text-red-500" />
              <div className="text-sm font-medium text-center text-red-600 whitespace-pre-line">
                {message}
              </div>
              {(ourRedirectUri || outstandError || error === "Missing code or state parameter") && (
                <OAuthDiagnostics
                  ourRedirectUri={ourRedirectUri}
                  copied={copied}
                  onCopy={async (text) => {
                    await navigator.clipboard.writeText(text)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                />
              )}
            </div>
          )}
        </SectionCardContent>
            {status === "selecting" && (
              <SectionCardFooter>
                <Button variant="outline" size="sm" onClick={handleBackToSettings}>
                  {t("public.oauth.cancel")}
                </Button>
                <Button
                  size="sm"
                  onClick={handleFinalize}
                  disabled={selectedPages.length === 0 || isFinalizing}
                >
                  {isFinalizing ? t("public.oauth.connecting") : t("public.oauth.connectCount", { count: selectedPages.length })}
                </Button>
              </SectionCardFooter>
            )}
            {status === "error" && (
              <SectionCardFooter>
                <Button variant="outline" size="sm" onClick={handleBackToSettings}>
                  {t("public.oauth.back")}
                </Button>
              </SectionCardFooter>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  </div>
  )
}
