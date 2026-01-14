"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2 } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { useCallback, useMemo, useState } from "react"
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

interface SocialSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

export function SocialSection({ active, onSave }: SocialSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [isSaving, setIsSaving] = useState(false)
  const socialMedia = form.watch("social_media") || []

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
    const newSocialMedia = [...currentSocialMedia, { 
      platform: "", 
      url: "",
      handle: "",
      phone: "",
      phoneCode: "+1",
      inviteCode: "",
      channelId: ""
    }]
    form.setValue("social_media", newSocialMedia)
  }, [form])

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

  if (!active) return null

  return (
    <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="px-8 py-6">
        <CardTitle className="text-xl font-semibold">Social Networks</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your social media profiles to your site
        </p>
      </CardHeader>
      <CardContent className="space-y-6 px-8 pb-8">
        {socialMedia.map((social, index) => {
          const platformConfig = getPlatformFields(social.platform);
          
          return (
            <div key={`social-row-${index}`} className="space-y-4">
              <div className="grid grid-cols-12 gap-4 items-center">
                <FormField
                  control={form.control}
                  name={`social_media.${index}.platform`}
                  render={({ field }) => (
                    <FormItem className="col-span-4 md:col-span-3">
                      <FormLabel className={index !== 0 ? "sr-only" : undefined}>
                        Platform
                      </FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="h-12">
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

                {social.platform && (
                  <>
                    {/* WhatsApp specific fields */}
                    {social.platform === 'whatsapp' && (
                      <>
                        <FormField
                          control={form.control}
                          name={`social_media.${index}.phoneCode`}
                          render={({ field }) => (
                            <FormItem className="col-span-3 md:col-span-3">
                              <FormLabel className={index !== 0 ? "sr-only" : undefined}>Country Code</FormLabel>
                              <Select
                                value={field.value || "+1"}
                                onValueChange={field.onChange}
                              >
                                <FormControl>
                                  <SelectTrigger className="h-12">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="z-[50]">
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
                        <FormField
                          control={form.control}
                          name={`social_media.${index}.phone`}
                          render={({ field }) => (
                            <FormItem className="col-span-4 md:col-span-5">
                              <FormLabel className={index !== 0 ? "sr-only" : undefined}>Phone Number</FormLabel>
                              <FormControl>
                                <div className="flex items-center relative">
                                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-[1]">
                                    {getPlatformIcon(social.platform, 16)}
                                  </div>
                                  <Input
                                    placeholder="123456789"
                                    {...field}
                                    className="pl-9 h-12"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Telegram specific fields */}
                    {social.platform === 'telegram' && (
                      <>
                        <FormField
                          control={form.control}
                          name={`social_media.${index}.handle`}
                          render={({ field }) => (
                            <FormItem className="col-span-3 md:col-span-4">
                              <FormLabel className={index !== 0 ? "sr-only" : undefined}>Username</FormLabel>
                              <FormControl>
                                <div className="flex items-center relative">
                                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-[1]">
                                    {getPlatformIcon(social.platform, 16)}
                                  </div>
                                  <Input
                                    placeholder="@username"
                                    {...field}
                                    className="pl-9 h-12"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`social_media.${index}.url`}
                          render={({ field }) => (
                            <FormItem className="col-span-4 md:col-span-4">
                              <FormLabel className={index !== 0 ? "sr-only" : undefined}>Invite Link (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="https://t.me/username"
                                  {...field}
                                  className="h-12"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Discord specific fields */}
                    {social.platform === 'discord' && (
                      <>
                        <FormField
                          control={form.control}
                          name={`social_media.${index}.inviteCode`}
                          render={({ field }) => (
                            <FormItem className="col-span-3 md:col-span-4">
                              <FormLabel className={index !== 0 ? "sr-only" : undefined}>Invite Code</FormLabel>
                              <FormControl>
                                <div className="flex items-center relative">
                                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-[1]">
                                    {getPlatformIcon(social.platform, 16)}
                                  </div>
                                  <Input
                                    placeholder="discord-invite-code"
                                    {...field}
                                    className="pl-9 h-12"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`social_media.${index}.url`}
                          render={({ field }) => (
                            <FormItem className="col-span-4 md:col-span-4">
                              <FormLabel className={index !== 0 ? "sr-only" : undefined}>Server URL (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="https://discord.gg/code"
                                  {...field}
                                  className="h-12"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* Default fields for other platforms */}
                    {!['whatsapp', 'telegram', 'discord'].includes(social.platform) && (
                      <>
                        <FormField
                          control={form.control}
                          name={`social_media.${index}.url`}
                          render={({ field }) => (
                            <FormItem className="col-span-3 md:col-span-4">
                              <FormLabel className={index !== 0 ? "sr-only" : undefined}>URL</FormLabel>
                              <FormControl>
                                <div className="flex items-center relative">
                                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-[1]">
                                    {getPlatformIcon(social.platform, 16)}
                                  </div>
                                  <Input
                                    placeholder="https://example.com/profile"
                                    {...field}
                                    className="pl-9 h-12"
                                  />
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`social_media.${index}.handle`}
                          render={({ field }) => (
                            <FormItem className="col-span-4 md:col-span-4">
                              <FormLabel className={index !== 0 ? "sr-only" : undefined}>Username (Optional)</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="@username"
                                  {...field}
                                  className="h-12"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    
                    <div className="col-span-1 flex items-center justify-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        type="button"
                        onClick={() => removeSocialMedia(index)}
                        className="h-12 w-12"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
        
        <Button
          variant="outline"
          className="mt-2 w-full h-12"
          type="button"
          onClick={addSocialMedia}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Social Network
        </Button>
        
        <div className="text-sm text-muted-foreground mt-4">
          <p>Connect your social media accounts to enhance your site's presence. Different platforms require different information.</p>
        </div>
      </CardContent>
      <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
        <Button 
          variant="outline"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </CardFooter>
    </Card>
  )
} 