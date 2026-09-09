"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { PlusCircle, Trash2 } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from "../ui/popover"
import { ChevronDown } from "../ui/icons"
import { useCallback, useMemo, useState, useEffect } from "react"
import { toast } from "sonner"
import { EmptyCard } from "../ui/empty-card"
import { BlueskyConnectForm } from "./BlueskyConnectForm"
import { 
  SocialIcon,
  FacebookIcon,
  TwitterIcon,
  InstagramIcon,
  LinkedInIcon,
  YouTubeIcon,
  TikTokIcon,
  PinterestIcon,
  ThreadsIcon,
  BlueskyIcon,
  GlobeIcon
} from "../ui/social-icons"
import { ConfirmDialog } from "../ui/confirm-dialog"
import { disconnectOutstandSocial } from "./disconnect-remote-accounts"
import { countSocialAccounts, getSocialAccountLimit, canConnectSocialAccount } from "@/lib/billing-limits"
import { useSite } from "@/app/context/SiteContext"
import { useBillingLimit } from "@/app/context/BillingLimitContext"

const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook", icon: FacebookIcon },
  { value: "twitter", label: "Twitter", icon: TwitterIcon },
  { value: "instagram", label: "Instagram", icon: InstagramIcon },
  { value: "threads", label: "Threads", icon: ThreadsIcon },
  { value: "linkedin", label: "LinkedIn", icon: LinkedInIcon },
  { value: "youtube", label: "YouTube", icon: YouTubeIcon },
  { value: "tiktok", label: "TikTok", icon: TikTokIcon },
  { value: "pinterest", label: "Pinterest", icon: PinterestIcon },
  { value: "bluesky", label: "Bluesky", icon: BlueskyIcon },
]

/** Platforms that support OAuth "Connect account" in this settings flow (see handleConnectAccount). */
const OAUTH_CONNECT_PLATFORM_VALUES = new Set([
  "facebook",
  "instagram",
  "threads",
  "twitter",
  "x",
  "youtube",
  "tiktok",
  "linkedin",
  "pinterest"
])

function isOAuthConnectablePlatform(platform: string | undefined): boolean {
  return !!platform && OAUTH_CONNECT_PLATFORM_VALUES.has(platform)
}

function isConnectablePlatform(platform: string | undefined): boolean {
  return isOAuthConnectablePlatform(platform) || platform === "bluesky"
}

// Country codes for phone fields
const COUNTRY_CODES = [
  // North America
  { value: "+1", label: "+1 (US/Canada)" },
  { value: "+52", label: "+52 (Mexico)" },
  // South America
  { value: "+55", label: "+55 (Brazil)" },
  { value: "+54", label: "+54 (Argentina)" },
  { value: "+57", label: "+57 (Colombia)" },
  { value: "+56", label: "+56 (Chile)" },
  { value: "+51", label: "+51 (Peru)" },
  { value: "+58", label: "+58 (Venezuela)" },
  { value: "+593", label: "+593 (Ecuador)" },
  { value: "+598", label: "+598 (Uruguay)" },
  { value: "+507", label: "+507 (Panama)" },
  { value: "+506", label: "+506 (Costa Rica)" },
  // Europe
  { value: "+44", label: "+44 (UK)" },
  { value: "+49", label: "+49 (Germany)" },
  { value: "+33", label: "+33 (France)" },
  { value: "+39", label: "+39 (Italy)" },
  { value: "+34", label: "+34 (Spain)" },
  { value: "+31", label: "+31 (Netherlands)" },
  { value: "+351", label: "+351 (Portugal)" },
  { value: "+32", label: "+32 (Belgium)" },
  { value: "+41", label: "+41 (Switzerland)" },
  { value: "+43", label: "+43 (Austria)" },
  { value: "+46", label: "+46 (Sweden)" },
  { value: "+45", label: "+45 (Denmark)" },
  { value: "+47", label: "+47 (Norway)" },
  { value: "+358", label: "+358 (Finland)" },
  { value: "+48", label: "+48 (Poland)" },
  { value: "+420", label: "+420 (Czech Republic)" },
  { value: "+36", label: "+36 (Hungary)" },
  { value: "+40", label: "+40 (Romania)" },
  { value: "+30", label: "+30 (Greece)" },
  { value: "+90", label: "+90 (Turkey)" },
  { value: "+7", label: "+7 (Russia)" },
  // Asia
  { value: "+86", label: "+86 (China)" },
  { value: "+81", label: "+81 (Japan)" },
  { value: "+91", label: "+91 (India)" },
  { value: "+82", label: "+82 (South Korea)" },
  { value: "+65", label: "+65 (Singapore)" },
  { value: "+852", label: "+852 (Hong Kong)" },
  { value: "+66", label: "+66 (Thailand)" },
  { value: "+63", label: "+63 (Philippines)" },
  { value: "+62", label: "+62 (Indonesia)" },
  { value: "+60", label: "+60 (Malaysia)" },
  { value: "+84", label: "+84 (Vietnam)" },
  { value: "+886", label: "+886 (Taiwan)" },
  { value: "+971", label: "+971 (UAE)" },
  { value: "+966", label: "+966 (Saudi Arabia)" },
  { value: "+972", label: "+972 (Israel)" },
  { value: "+92", label: "+92 (Pakistan)" },
  { value: "+880", label: "+880 (Bangladesh)" },
  // Africa
  { value: "+20", label: "+20 (Egypt)" },
  { value: "+27", label: "+27 (South Africa)" },
  { value: "+234", label: "+234 (Nigeria)" },
  { value: "+254", label: "+254 (Kenya)" },
  { value: "+212", label: "+212 (Morocco)" },
  { value: "+216", label: "+216 (Tunisia)" },
  { value: "+233", label: "+233 (Ghana)" },
  // Oceania
  { value: "+61", label: "+61 (Australia)" },
  { value: "+64", label: "+64 (New Zealand)" },
  { value: "+679", label: "+679 (Fiji)" }
];

// Function to get platform icon - memoized
const getPlatformIcon = (platform: string | undefined, size: number = 16) => {
  if (!platform) return <GlobeIcon size={size} />;
  
  switch (platform.toLowerCase()) {
    case 'facebook': return <FacebookIcon size={size} />;
    case 'twitter': case 'x': return <TwitterIcon size={size} />;
    case 'instagram': return <InstagramIcon size={size} />;
    case 'threads': return <ThreadsIcon size={size} />;
    case 'linkedin': return <LinkedInIcon size={size} />;
    case 'youtube': return <YouTubeIcon size={size} />;
    case 'tiktok': return <TikTokIcon size={size} />;
    case 'pinterest': return <PinterestIcon size={size} />;
    case 'bluesky': return <BlueskyIcon size={size} />;
    default: return <GlobeIcon size={size} />;
  }
};

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

  // Memoize platform-specific configuration
  const getPlatformFields = useMemo(() => {
    return (platform: string) => {
      switch (platform) {
        case 'whatsapp':
          return {
            fields: ["phone", "phoneCode"],
            labels: {
              phone: "Phone Number",
              phoneCode: "Country Code"
            },
            placeholders: {
              phone: "123456789"
            }
          };
        case 'telegram':
          return {
            fields: ["handle", "url"],
            labels: {
              handle: "Username",
              url: "Invite Link"
            },
            placeholders: {
              handle: "@username",
              url: "https://t.me/username"
            }
          };
        case 'discord':
          return {
            fields: ["inviteCode", "url"],
            labels: {
              inviteCode: "Invite Code",
              url: "Server URL"
            },
            placeholders: {
              inviteCode: "discord-invite-code",
              url: "https://discord.gg/code"
            }
          };
        default:
          return {
            fields: ["url", "handle"],
            labels: {
              url: "URL",
              handle: "Username"
            },
            placeholders: {
              url: "https://example.com/profile",
              handle: "@username"
            }
          };
      }
    }
  }, [])

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
        {socialMedia.map((social, index) => {
          const isActive = social.isActive === true || social.isActive === 1
          const hasPlatform = !!social.platform
          const platformLabel = SOCIAL_PLATFORMS.find(p => p.value === social.platform)?.label || social.platform || "New Network";
          
          return (
            <SectionCard 
              key={`social-row-${index}`} 
              id={`social-network-${index}`}
            >
              <SectionCardHeader>
                 <div className="flex items-center justify-between">
                   <SectionCardTitle className="flex items-center gap-2">
                     {getPlatformIcon(social.platform, 20)}
                     {platformLabel}
                   </SectionCardTitle>
                   
                   <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={() => setSocialToDelete(index)}
                    className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Remove Network"
                   >
                     <Trash2 className="h-5 w-5" />
                   </Button>
                 </div>
              </SectionCardHeader>
              
              <SectionCardContent className="space-y-4">
                  {/* Platform selector - only show when no platform selected (new entry) */}
                  {!hasPlatform && (
                    <FormField
                      control={form.control}
                      name={`social_media.${index}.platform`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Platform</FormLabel>
                          <Popover>
                            <FormControl>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="flex h-12 w-full min-w-0 font-inter items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-left overflow-hidden font-normal"
                                >
                                  {field.value ? (() => {
                                    const selectedItem = SOCIAL_PLATFORMS.find(p => p.value === field.value)
                                    const Icon = selectedItem?.icon
                                    return (
                                      <div className="flex items-center gap-2 overflow-hidden">
                                        {Icon && <Icon size={16} className="flex-shrink-0" />}
                                        <span className="truncate">
                                          {selectedItem?.label || field.value}
                                        </span>
                                      </div>
                                    )
                                  })() : (
                                    <span className="text-muted-foreground">Select Platform</span>
                                  )}
                                  <ChevronDown className="h-3.5 w-3.5 opacity-50 flex-shrink-0 ml-2" />
                                </Button>
                              </PopoverTrigger>
                            </FormControl>
                            <PopoverContent className="z-[50] w-[var(--radix-popover-trigger-width)] min-w-[200px] p-1" align="start">
                              {SOCIAL_PLATFORMS.map((platform) => {
                                const Icon = platform.icon
                                return (
                                  <PopoverClose asChild key={platform.value}>
                                    <div
                                      onClick={() => field.onChange(platform.value)}
                                      className="cursor-pointer flex items-center justify-between w-full min-w-0 gap-2 px-2 py-1.5 rounded-sm hover:bg-accent hover:text-accent-foreground text-sm"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <Icon size={16} className="flex-shrink-0" />
                                        <span className="truncate">{platform.label}</span>
                                      </div>
                                    </div>
                                  </PopoverClose>
                                )
                              })}
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Connected account info - show when active */}
                  {isActive && hasPlatform && (
                    <div className="flex items-center gap-4 w-full p-4 bg-muted/20 rounded-lg border dark:border-white/5 border-black/5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {social.profile_picture_url && !imageErrors[index] && (
                          <img 
                            src={social.profile_picture_url} 
                            alt={social.nickname || social.username || social.handle || social.platform}
                            className="w-12 h-12 rounded-full font-inter flex-shrink-0 border dark:border-white/5 border-black/5"
                            onError={() => {
                              setImageErrors(prev => ({ ...prev, [index]: true }))
                            }}
                          />
                        )}
                        {(!social.profile_picture_url || imageErrors[index]) && (
                          <div className="w-12 h-12 rounded-full font-inter font-bold bg-muted flex items-center justify-center flex-shrink-0 border dark:border-white/5 border-black/5">
                            {getPlatformIcon(social.platform || social.network, 24)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium truncate">
                            {social.nickname || `${platformLabel} Account`}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Connected
                            </span>
                          </div>
                        </div>
                      </div>
                      {isOAuthConnectablePlatform(social.platform) && (
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => handleConnectAccount(index)}
                          className="whitespace-nowrap"
                        >
                          Reconnect
                        </Button>
                      )}
                      {social.platform === "bluesky" && siteId && (
                        <Button
                          variant="outline"
                          type="button"
                          onClick={() => {
                            form.setValue(`social_media.${index}.isActive`, false)
                          }}
                          className="whitespace-nowrap"
                        >
                          Reconnect
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Connect/Reconnect Account - show when platform selected but not active */}
                  {hasPlatform && !isActive && isOAuthConnectablePlatform(social.platform) && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/30">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full font-inter font-bold bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0 text-orange-600">
                          {getPlatformIcon(social.platform || social.network, 20)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate text-orange-800 dark:text-orange-200">
                            Action Required
                          </p>
                          {(social.username || social.handle) ? (
                            <>
                              <p className="text-sm text-muted-foreground truncate">
                                {social.username || social.handle}
                              </p>
                              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                                Connection lost - reconnect to continue
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Authenticate to connect this account
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="default"
                        type="button"
                        onClick={() => handleConnectAccount(index)}
                        className="whitespace-nowrap bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        {(social.username || social.handle || social.nickname) ? 'Reconnect' : 'Connect Account'}
                      </Button>
                    </div>
                  )}
                  
                  {/* Bluesky App Password Connect */}
                  {hasPlatform && !isActive && social.platform === 'bluesky' && siteId && (
                    canConnectSocialAccount(currentSite) ? (
                    <BlueskyConnectForm
                      siteId={siteId}
                      onConnected={() => {
                        toast.success("Bluesky connected successfully")
                        window.location.reload()
                      }}
                    />
                    ) : (
                      <Button type="button" variant="outline" size="sm" onClick={openAccountLimit}>
                        Upgrade to connect
                      </Button>
                    )
                  )}

                  {/* Manual fields only when the account is not OAuth-linked (username/URL come from the provider when linked) */}
                  {hasPlatform && !isActive && !isOAuthConnectablePlatform(social.platform) && social.platform !== 'bluesky' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                       {getPlatformFields(social.platform).fields.includes("url") && (
                         <FormField
                           control={form.control}
                           name={`social_media.${index}.url`}
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>{getPlatformFields(social.platform).labels.url}</FormLabel>
                               <FormControl>
                                 <Input placeholder={getPlatformFields(social.platform).placeholders.url} {...field} />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                       )}
                       {getPlatformFields(social.platform).fields.includes("handle") && (
                         <FormField
                           control={form.control}
                           name={`social_media.${index}.handle`}
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>{getPlatformFields(social.platform).labels.handle}</FormLabel>
                               <FormControl>
                                 <Input placeholder={getPlatformFields(social.platform).placeholders.handle} {...field} />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                       )}
                       {getPlatformFields(social.platform).fields.includes("phone") && (
                         <FormField
                           control={form.control}
                           name={`social_media.${index}.phone`}
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>{getPlatformFields(social.platform).labels.phone}</FormLabel>
                               <FormControl>
                                 <Input placeholder={getPlatformFields(social.platform).placeholders.phone} {...field} />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                       )}
                       {getPlatformFields(social.platform).fields.includes("phoneCode") && (
                         <FormField
                           control={form.control}
                           name={`social_media.${index}.phoneCode`}
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>{getPlatformFields(social.platform).labels.phoneCode}</FormLabel>
                               <Select onValueChange={field.onChange} value={field.value}>
                                 <FormControl>
                                   <SelectTrigger>
                                     <SelectValue placeholder="Select Country Code" />
                                   </SelectTrigger>
                                 </FormControl>
                                 <SelectContent>
                                    {COUNTRY_CODES.map((code) => (
                                      <SelectItem key={code.value} value={code.value}>
                                        {code.label}
                                      </SelectItem>
                                    ))}
                                 </SelectContent>
                               </Select>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                       )}
                       {getPlatformFields(social.platform).fields.includes("inviteCode") && (
                         <FormField
                           control={form.control}
                           name={`social_media.${index}.inviteCode`}
                           render={({ field }) => (
                             <FormItem>
                               <FormLabel>{getPlatformFields(social.platform).labels.inviteCode}</FormLabel>
                               <FormControl>
                                 <Input placeholder={getPlatformFields(social.platform).placeholders.inviteCode} {...field} />
                               </FormControl>
                               <FormMessage />
                             </FormItem>
                           )}
                         />
                       )}
                    </div>
                  )}
              </SectionCardContent>
              {!(isActive && hasPlatform) && (
                <SectionCardFooter>
                  <Button variant="outline" size="sm"
                    onClick={() => handleSave(index)}
                    disabled={savingCard === index || !form.formState.isDirty}
                  >
                    {savingCard === index ? (
                      <>
                        <div className="h-4 w-4 mr-2 animate-spin rounded-full font-inter border-2 border-current border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </SectionCardFooter>
              )}
            </SectionCard>
          )
        })}
        
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