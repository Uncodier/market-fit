"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2 } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { useCallback, useMemo } from "react"
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
  { value: "+1", label: "+1 (US)" },
  { value: "+44", label: "+44 (UK)" },
  { value: "+34", label: "+34 (Spain)" },
  { value: "+52", label: "+52 (Mexico)" },
  { value: "+91", label: "+91 (India)" },
  { value: "+55", label: "+55 (Brazil)" },
  { value: "+49", label: "+49 (Germany)" },
  { value: "+33", label: "+33 (France)" },
  { value: "+81", label: "+81 (Japan)" },
  { value: "+86", label: "+86 (China)" },
  { value: "+39", label: "+39 (Italy)" },
  { value: "+7", label: "+7 (Russia)" },
  { value: "+82", label: "+82 (South Korea)" },
  { value: "+61", label: "+61 (Australia)" }
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
}

export function SocialSection({ active }: SocialSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const socialMedia = form.watch("social_media") || []

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
    </Card>
  )
} 