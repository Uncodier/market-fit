"use client"

import { useCallback, useEffect, useState } from "react"
import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { Button } from "../ui/button"
import { PlusCircle } from "../ui/icons"
import { toast } from "sonner"
import { EmptyCard } from "../ui/empty-card"
import { GlobeIcon } from "../ui/social-icons"
import { ConfirmDialog } from "../ui/confirm-dialog"
import { disconnectOutstandSocial } from "./disconnect-remote-accounts"
import { countSocialAccounts, getSocialAccountLimit, canConnectSocialAccount } from "@/lib/billing-limits"
import { useSite } from "@/app/context/SiteContext"
import { useBillingLimit } from "@/app/context/BillingLimitContext"
import { SocialAccountCard } from "./SocialAccountCard"
import {
  isOAuthConnectablePlatform,
  SOCIAL_PLATFORMS,
} from "./social-section-config"

interface SocialSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
  siteId?: string
}

export function SocialSection({ active, onSave, siteId }: SocialSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const { currentSite } = useSite()
  const { showBillingLimit, showBillingLimitFromError } = useBillingLimit()
  const openAccountLimit = () => {
    showBillingLimit({
      kind: "accounts",
      current: countSocialAccounts(currentSite),
      limit: getSocialAccountLimit(currentSite?.billing?.plan) + (currentSite?.billing?.addons_count || 0),
    })
  }
  const [savingCard, setSavingCard] = useState<number | null>(null)
  const socialMedia = form.watch("social_media") || []
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({})
  const [socialToDelete, setSocialToDelete] = useState<number | null>(null)

  // Emit social networks update event whenever socialMedia changes
  useEffect(() => {
    if (active) {
      const socialNetworksData = socialMedia.map((social, index) => ({
        id: `social-network-${index}`,
        title: social.platform ? (SOCIAL_PLATFORMS.find(p => p.value === social.platform)?.label || social.platform) : "New Network",
      }));
      
      window.dispatchEvent(new CustomEvent('socialNetworksUpdated', { 
        detail: socialNetworksData 
      }));
    }
  }, [active, socialMedia]);

  const handleSave = async (index: number) => {
    if (!onSave) return
    setSavingCard(index)
    try {
      const formData = form.getValues()
      await onSave(formData)
      form.reset(formData)
    } catch (error) {
      console.error("Error saving social media:", error)
    } finally {
      setSavingCard(null)
    }
  }

  // Memoized functions for better performance
  const addSocialMedia = useCallback(() => {
    const limit = getSocialAccountLimit(currentSite?.billing?.plan) + (currentSite?.billing?.addons_count || 0)
    const currentCount = countSocialAccounts(currentSite)
    if (!canConnectSocialAccount(currentSite)) {
      showBillingLimit({ kind: "accounts", current: currentCount, limit })
      return
    }

    const currentSocialMedia = form.getValues("social_media") || []
    const newSocialMedia = [{ 
      platform: "",
      isActive: false
    } as any, ...currentSocialMedia]
    form.setValue("social_media", newSocialMedia)
  }, [form, currentSite, socialMedia.length, showBillingLimit])

  const handleConnectAccount = useCallback(async (index: number) => {
    const social = socialMedia[index]
    if (!social?.platform || !siteId) return
    if (!isOAuthConnectablePlatform(social.platform)) return

    // Validate account limits
    const limit = getSocialAccountLimit(currentSite?.billing?.plan) + (currentSite?.billing?.addons_count || 0)
    const currentCount = countSocialAccounts(currentSite)
    
    if (!social.isActive && !canConnectSocialAccount(currentSite)) {
      showBillingLimit({ kind: "accounts", current: currentCount, limit })
      return
    }

    try {
      setSavingCard(index)
      
      // When SSH_TUNNEL_URL (or NEXT_PUBLIC_SSH_TUNNEL_URL) is set, use it so OAuth redirects back to the tunnel.
      // In .env.local set NEXT_PUBLIC_SSH_TUNNEL_URL=https://xxx.trycloudflare.com (client needs NEXT_PUBLIC_)
      const tunnelBase = (process.env.NEXT_PUBLIC_SSH_TUNNEL_URL || '').replace(/\/$/, '')
      const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const productionDomain = process.env.NEXT_PUBLIC_PRODUCTION_URL || 'https://app.makinari.com'
      // Force production to rule out tunnel: set NEXT_PUBLIC_FORCE_PRODUCTION_OAUTH_REDIRECT=true
      const forceProd = process.env.NEXT_PUBLIC_FORCE_PRODUCTION_OAUTH_REDIRECT === 'true'
      const redirectOrigin = forceProd ? productionDomain : (tunnelBase || (isDevelopment ? productionDomain : window.location.origin))

      // 3-leg flow for Facebook and LinkedIn: OAuth redirects to OUR callback (/api/social/callback/:network).
      // We exchange code+state with outstand.so for a session token, then redirect to /settings/social_network.
      // Other networks: outstand.so receives the OAuth callback and redirects to /settings/social_network with session.
      const is3Leg = social.platform === 'facebook' || social.platform === 'instagram' || social.platform === 'threads' || social.platform === 'twitter' || social.platform === 'x' || social.platform === 'youtube' || social.platform === 'tiktok' || social.platform === 'linkedin' || social.platform === 'pinterest'
      const redirectUri = is3Leg
        ? `${redirectOrigin}/api/social/callback/${social.platform}?siteId=${encodeURIComponent(siteId)}`
        : `${redirectOrigin}/settings/social_network?siteId=${siteId}&network=${social.platform}${isDevelopment ? `&returnTo=${encodeURIComponent(window.location.origin)}` : ''}`
      
      console.log('[Social Auth] Initiating OAuth flow:', {
        platform: social.platform,
        siteId,
        redirectUri,
        isDevelopment,
        currentOrigin: window.location.origin,
        productionDomain,
        note: 'IMPORTANT: This redirect_uri MUST be whitelisted in outstand.so system. Contact support if you get "Missing code or state parameter" error.'
      })
      
      const response = await fetch(
        `/api/social/${encodeURIComponent(social.platform)}/auth-url?siteId=${encodeURIComponent(siteId)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            redirect_uri: redirectUri,
            tenant_id: siteId,
          }),
        }
      )
      
      const result = await response.json()
      
      if (result.success && result.data?.auth_url) {
        console.log('[Social Auth] Redirecting to OAuth URL:', result.data.auth_url.substring(0, 100) + '...')
        // Redirect to the OAuth URL
        window.location.href = result.data.auth_url
      } else {
        console.error('[Social Auth] Failed to get auth URL:', result)
        if (showBillingLimitFromError(result) || showBillingLimitFromError(result.error)) {
          return
        }
        throw new Error(result.error || 'Failed to get authentication URL')
      }
    } catch (error) {
      console.error('Error connecting social account:', error)
      if (!showBillingLimitFromError(error)) {
        toast.error(error instanceof Error ? error.message : 'Failed to connect account')
      }
    } finally {
      setSavingCard(null)
    }
  }, [socialMedia, siteId, currentSite, showBillingLimitFromError])

  const removeSocialMedia = useCallback(async (index: number) => {
    const currentSocialMedia = form.getValues("social_media") || []
    const social = currentSocialMedia[index]
    try {
      await disconnectOutstandSocial(social || {}, siteId)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect social account")
      throw error
    }
    const newSocialMedia = currentSocialMedia.filter((_, i) => i !== index)
    form.setValue("social_media", newSocialMedia, { shouldDirty: true })
    if (onSave) {
      await onSave(form.getValues())
    }
  }, [form, onSave, siteId])

  if (!active) return null

  return (
    <div id="social-networks-section" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Social Networks</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Connect your social media profiles to your site
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={addSocialMedia}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Social Network
        </Button>
      </div>

      <div className="space-y-6">
        {socialMedia.map((social, index) => (
          <SocialAccountCard
            key={`social-row-${index}`}
            canConnectAccount={canConnectSocialAccount(currentSite)}
            form={form}
            imageError={imageErrors[index] === true}
            index={index}
            isSaving={savingCard === index}
            onConnect={handleConnectAccount}
            onConnected={() => {
              toast.success("Bluesky connected successfully")
              window.location.reload()
            }}
            onImageError={(failedIndex) => {
              setImageErrors((previous) => ({
                ...previous,
                [failedIndex]: true,
              }))
            }}
            onOpenAccountLimit={openAccountLimit}
            onRequestDelete={setSocialToDelete}
            onSave={handleSave}
            siteId={siteId}
            social={social}
          />
        ))}
        
        {socialMedia.length === 0 && (
          <EmptyCard 
            icon={<GlobeIcon size={40} />}
            title="No social networks connected"
            description="Connect your social media accounts to display them on your website and track performance."
            variant="fancy"
          />
        )}
      </div>

      <ConfirmDialog
        open={socialToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSocialToDelete(null)
        }}
        title="Delete Social Network"
        description="This will remove the social network from your site. This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (socialToDelete !== null) await removeSocialMedia(socialToDelete)
        }}
      />
    </div>
  )
}