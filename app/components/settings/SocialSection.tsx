"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, Save } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { useCallback, useMemo, useState, useEffect } from "react"
import { 
  SocialIcon,
  FacebookIcon,
  TwitterIcon,
  InstagramIcon,
  LinkedInIcon,
  YouTubeIcon,
  TikTokIcon,
  PinterestIcon,
  GitHubIcon,
  RedditIcon,
  MediumIcon,
  WhatsAppIcon,
  TelegramIcon,
  DiscordIcon,
  GlobeIcon
} from "../ui/social-icons"

const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "pinterest", label: "Pinterest" },
  { value: "github", label: "GitHub" },
  { value: "reddit", label: "Reddit" },
  { value: "medium", label: "Medium" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
  { value: "custom", label: "Custom" }
]

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
    case 'linkedin': return <LinkedInIcon size={size} />;
    case 'youtube': return <YouTubeIcon size={size} />;
    case 'tiktok': return <TikTokIcon size={size} />;
    case 'pinterest': return <PinterestIcon size={size} />;
    case 'github': return <GitHubIcon size={size} />;
    case 'reddit': return <RedditIcon size={size} />;
    case 'medium': return <MediumIcon size={size} />;
    case 'whatsapp': return <WhatsAppIcon size={size} />;
    case 'telegram': return <TelegramIcon size={size} />;
    case 'discord': return <DiscordIcon size={size} />;
    default: return <GlobeIcon size={size} />;
  }
};

const IS_HIDDEN = false;

interface SocialSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
  siteId?: string
}

export function SocialSection({ active, onSave, siteId }: SocialSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [isSaving, setIsSaving] = useState(false)
  const socialMedia = form.watch("social_media") || []

  // Emit social networks update event whenever socialMedia changes
  useEffect(() => {
    if (active && !IS_HIDDEN) {
      const socialNetworksData = socialMedia.map((social, index) => ({
        id: `social-network-${index}`,
        title: social.platform ? (SOCIAL_PLATFORMS.find(p => p.value === social.platform)?.label || social.platform) : "New Network",
      }));
      
      window.dispatchEvent(new CustomEvent('socialNetworksUpdated', { 
        detail: socialNetworksData 
      }));
    }
  }, [active, socialMedia]);

  const handleSave = async () => {
    if (!onSave) return
    setIsSaving(true)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving social media:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Memoized functions for better performance
  const addSocialMedia = useCallback(() => {
    const currentSocialMedia = form.getValues("social_media") || []
    const newSocialMedia = [{ 
      platform: "",
      isActive: false
    }, ...currentSocialMedia]
    form.setValue("social_media", newSocialMedia)
  }, [form])

  const handleConnectAccount = useCallback(async (index: number) => {
    const social = socialMedia[index]
    if (!social?.platform || !siteId) return
    
    try {
      setIsSaving(true)
      
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
      const is3Leg = social.platform === 'facebook' || social.platform === 'linkedin'
      const redirectUri = is3Leg
        ? `${redirectOrigin}/api/social/callback/${social.platform}`
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
      
      // Call our API to get the auth URL
      const response = await fetch(`/api/social/${social.platform}/auth-url?siteId=${siteId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          redirect_uri: redirectUri,
          tenant_id: siteId, // Use siteId as tenant_id
        }),
      })
      
      const result = await response.json()
      
      if (result.success && result.data?.auth_url) {
        console.log('[Social Auth] Redirecting to OAuth URL:', result.data.auth_url.substring(0, 100) + '...')
        // Redirect to the OAuth URL
        window.location.href = result.data.auth_url
      } else {
        console.error('[Social Auth] Failed to get auth URL:', result)
        throw new Error(result.error || 'Failed to get authentication URL')
      }
    } catch (error) {
      console.error('Error connecting social account:', error)
      // You might want to show a toast error here
      alert(error instanceof Error ? error.message : 'Failed to connect account')
    } finally {
      setIsSaving(false)
    }
  }, [socialMedia, siteId])

  const removeSocialMedia = useCallback((index: number) => {
    const currentSocialMedia = form.getValues("social_media") || []
    const newSocialMedia = currentSocialMedia.filter((_, i) => i !== index)
    form.setValue("social_media", newSocialMedia)
  }, [form])

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

  if (!active || IS_HIDDEN) return null

  return (
    <div id="social-networks-section" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Social Networks</h2>
          <p className="text-sm text-muted-foreground mt-1">
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
            <Card 
              key={`social-row-${index}`} 
              id={`social-network-${index}`}
              className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200"
            >
              <CardHeader className="px-8 py-6">
                 <div className="flex items-center justify-between">
                   <CardTitle className="text-xl font-semibold flex items-center gap-2">
                     {getPlatformIcon(social.platform, 20)}
                     {platformLabel}
                   </CardTitle>
                   
                   <Button
                    size="icon"
                    variant="ghost"
                    type="button"
                    onClick={() => removeSocialMedia(index)}
                    className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                    title="Remove Network"
                   >
                     <Trash2 className="h-5 w-5" />
                   </Button>
                 </div>
              </CardHeader>
              
              <CardContent className="space-y-6 px-8 pb-8">
                  {/* Platform selector - only show when no platform selected (new entry) */}
                  {!hasPlatform && (
                    <FormField
                      control={form.control}
                      name={`social_media.${index}.platform`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Platform</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="h-12 w-full">
                                <SelectValue placeholder="Select Platform" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="z-[50]">
                              {SOCIAL_PLATFORMS.map((platform) => (
                                <SelectItem key={platform.value} value={platform.value}>
                                  <div className="flex items-center gap-2">
                                    {getPlatformIcon(platform.value, 16)}
                                    <span>{platform.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {/* Connected account info - show when active */}
                  {isActive && hasPlatform && (
                    <div className="flex items-center gap-4 w-full p-4 bg-muted/20 rounded-lg border border-border">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {social.profile_picture_url && (
                          <img 
                            src={social.profile_picture_url} 
                            alt={social.nickname || social.username || social.handle || social.platform}
                            className="w-12 h-12 rounded-full flex-shrink-0 border border-border"
                          />
                        )}
                        {!social.profile_picture_url && (
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0 border border-border">
                            {getPlatformIcon(social.platform || social.network, 24)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-medium truncate">
                            {social.nickname || `${platformLabel} Account`}
                          </p>
                          {(social.username || social.handle) && (
                            <p className="text-sm text-muted-foreground truncate">
                              {social.username || social.handle}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Connected
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        type="button"
                        onClick={() => handleConnectAccount(index)}
                        className="whitespace-nowrap"
                      >
                        Reconnect
                      </Button>
                    </div>
                  )}

                  {/* Connect/Reconnect Account - show when platform selected but not active */}
                  {hasPlatform && !isActive && (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900/30">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center flex-shrink-0 text-orange-600">
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
                  
                  {/* Manual Fields (URL, Handle) - always show if platform selected so user can edit manual info */}
                  {hasPlatform && (
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
              </CardContent>
              <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
                <Button 
                  variant="outline"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
        
        {socialMedia.length === 0 && (
          <div className="text-center py-12 border border-dashed rounded-lg bg-muted/10">
            <h3 className="text-lg font-medium mb-2">No social networks connected</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Connect your social media accounts to display them on your website and track performance.
            </p>
            <Button onClick={addSocialMedia}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Your First Network
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}