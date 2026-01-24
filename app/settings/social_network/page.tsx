"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"
import { CheckCircle, XCircle, Loader } from "@/app/components/ui/icons"
import { Checkbox } from "@/app/components/ui/checkbox"

interface AvailablePage {
  id: string
  name: string
  username?: string
  profile_picture_url?: string
  accountType?: string
}

export default function SocialNetworkCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "selecting" | "success" | "error">("loading")
  const [message, setMessage] = useState<string>("")
  const [availablePages, setAvailablePages] = useState<AvailablePage[]>([])
  const [selectedPages, setSelectedPages] = useState<string[]>([])
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
          setMessage(
            "OAuth callback failed: Outstand.so received the callback from Facebook but could not process it. " +
            "The redirect_uri is being used correctly, but outstand.so is failing to process the Facebook callback.\n\n" +
            "Possible causes:\n" +
            "1. Your redirect_uri needs to be whitelisted in outstand.so's system (they validate before processing)\n" +
            "2. There's an internal issue with outstand.so's Facebook OAuth callback handler\n" +
            "3. Configuration issue with outstand.so's Facebook app settings\n\n" +
            "Please contact outstand.so support (contact@outstand.so) and provide:\n" +
            "- Your redirect_uri pattern: https://app.makinari.com/settings/social_network*\n" +
            "- The error: Missing code or state parameter\n" +
            "- That Facebook successfully redirects to outstand.so, but outstand.so fails to process it"
          )
        } else if (error === "access_denied") {
          setMessage("Authentication was cancelled. Please try again and authorize the connection.")
        } else if (error === "oauth_failed") {
          setMessage(searchParams.get("error_description") || "OAuth failed.")
        } else {
          setMessage(`Authentication failed: ${error}`)
        }
        return
      }

      // Check for other error indicators
      const errorDescription = searchParams.get("error_description")
      if (errorDescription) {
        setStatus("error")
        setMessage(`Authentication failed: ${errorDescription}`)
        return
      }

      // No session token - might be initial load or incomplete callback
      console.warn('[Social Network Callback] No session token and no error - this should not happen in normal flow')
      setStatus("loading")
      setMessage("Waiting for authentication response...")
      
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
        setMessage("Loading available pages...")
        
        const response = await fetch(`/api/social/accounts/pending/${session}`)
        const result = await response.json()
        
        if (result.success && result.data) {
          const pages = result.data.availablePages || result.data.pages || []
          setAvailablePages(pages)
          
          if (pages.length === 0) {
            setStatus("error")
            setMessage("No pages available to connect. Please make sure you have authorized the necessary permissions.")
          } else {
            setStatus("selecting")
            setMessage(`Select the ${network} pages you want to connect:`)
            // Pre-select all pages by default
            setSelectedPages(pages.map((p: AvailablePage) => p.id))
          }
        } else {
          throw new Error(result.error || "Failed to load available pages")
        }
      } catch (error) {
        console.error("Error fetching available pages:", error)
        setStatus("error")
        setMessage(error instanceof Error ? error.message : "Failed to load available pages")
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
      setMessage("Please select at least one page to connect.")
      return
    }

    try {
      setIsFinalizing(true)
      setMessage("Connecting selected pages...")
      
      const response = await fetch(`/api/social/accounts/pending/${session}/finalize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ accountIds: selectedPages }),
      })
      
      const result = await response.json()
      
      if (result.success) {
        setStatus("success")
        setMessage(`Successfully connected ${selectedPages.length} page(s)!`)
        
        // Redirect back to settings after a delay
        setTimeout(() => {
          const redirectUrl = returnTo 
            ? `${returnTo}/settings?tab=social` 
            : `/settings?tab=social`
          router.push(redirectUrl)
        }, 2000)
      } else {
        throw new Error(result.error || "Failed to finalize connection")
      }
    } catch (error) {
      console.error("Error finalizing connection:", error)
      setStatus("error")
      setMessage(error instanceof Error ? error.message : "Failed to finalize connection")
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

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">
            {network ? `${network.charAt(0).toUpperCase() + network.slice(1)} Authentication` : "Social Network Authentication"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                {message || "Processing authentication..."}
              </p>
            </div>
          )}

          {status === "selecting" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                {message}
              </p>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {availablePages.map((page) => (
                  <div
                    key={page.id}
                    className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleTogglePage(page.id)}
                  >
                    <Checkbox
                      checked={selectedPages.includes(page.id)}
                      onCheckedChange={() => handleTogglePage(page.id)}
                    />
                    {page.profile_picture_url && (
                      <img
                        src={page.profile_picture_url}
                        alt={page.name}
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{page.name}</p>
                      {page.username && (
                        <p className="text-xs text-muted-foreground truncate">{page.username}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleBackToSettings}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleFinalize}
                  disabled={selectedPages.length === 0 || isFinalizing}
                  className="flex-1"
                >
                  {isFinalizing ? "Connecting..." : `Connect ${selectedPages.length} Page(s)`}
                </Button>
              </div>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <p className="text-sm font-medium text-center">{message}</p>
              <p className="text-xs text-muted-foreground text-center">
                Redirecting to settings...
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
                <div className="w-full text-left space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Copy and send to Outstand (contact@outstand.so):</p>
                  <pre className="text-xs p-3 bg-muted rounded overflow-x-auto whitespace-pre-wrap font-sans">
                    {`Subject: Facebook OAuth "Missing code or state parameter" — whitelist redirect_uri and check your callback

We use the white-label flow. Our redirect_uri (where you should send the user with ?session= or ?error=) is:
${ourRedirectUri || "https://[your-domain]/api/social/callback/facebook"}

We pass it in the auth-url body; it appears in the Outstand URL you return. Facebook redirects to your callback; you redirect to us. We get: error=Missing code or state parameter.

Please:
1. Confirm our redirect_uri is whitelisted for our account/API key.
2. When you receive the callback from Facebook at .../facebook/callback, do you get code and state? If not, we will recheck Facebook Valid OAuth Redirect URIs (https://www.outstand.so/app/api/socials/facebook/callback) and App Domains. If you do get them, what fails on your side?
3. Do you have an exchange API (e.g. we receive code+state from Facebook, POST to you to get session) to bypass this?`}
                  </pre>
                  <p className="text-xs text-muted-foreground">
                    If our redirect_uri is a tunnel: try from production (app.makinari.com) and ask Outstand to whitelist <code className="text-[10px]">https://app.makinari.com/api/social/callback/facebook</code>. Or set <code className="text-[10px]">NEXT_PUBLIC_FORCE_PRODUCTION_OAUTH_REDIRECT=true</code> to use it from localhost.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const t = `Subject: Facebook OAuth "Missing code or state parameter" — whitelist redirect_uri and check your callback

We use the white-label flow. Our redirect_uri (where you should send the user with ?session= or ?error=) is:
${ourRedirectUri || "https://[your-domain]/api/social/callback/facebook"}

We pass it in the auth-url body; it appears in the Outstand URL you return. Facebook redirects to your callback; you redirect to us. We get: error=Missing code or state parameter.

Please:
1. Confirm our redirect_uri is whitelisted for our account/API key.
2. When you receive the callback from Facebook at .../facebook/callback, do you get code and state? If not, we will recheck Facebook Valid OAuth Redirect URIs (https://www.outstand.so/app/api/socials/facebook/callback) and App Domains. If you do get them, what fails on your side?
3. Do you have an exchange API (e.g. we receive code+state from Facebook, POST to you to get session) to bypass this?`
                      await navigator.clipboard.writeText(t)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }}
                  >
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              )}
              <Button onClick={handleBackToSettings} variant="outline" className="mt-4">
                Back to Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
