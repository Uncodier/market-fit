"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2 } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { useState, useEffect } from "react"
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

// Mapping of platforms to their required fields
const PLATFORM_FIELDS = {
  "whatsapp": ["phone", "phoneCode"],
  "telegram": ["handle", "url"],
  "discord": ["inviteCode", "url"],
  "default": ["url", "handle"]
};

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

// Function to get platform icon
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

// Get platform-specific fields and proper labels
const getPlatformFields = (platform: string) => {
  switch (platform) {
    case 'whatsapp':
      return {
        fields: PLATFORM_FIELDS.whatsapp,
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
        fields: PLATFORM_FIELDS.telegram,
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
        fields: PLATFORM_FIELDS.discord,
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
        fields: PLATFORM_FIELDS.default,
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
};

interface SocialSectionProps {
  active: boolean
}

export function SocialSection({ active }: SocialSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [socialList, setSocialList] = useState<{
    platform: string, 
    url: string, 
    handle?: string,
    phone?: string,
    phoneCode?: string,
    inviteCode?: string,
    channelId?: string
  }[]>(
    form.getValues("social_media") || []
  )
  const [forceUpdate, setForceUpdate] = useState(0)

  // Force re-render on component mount
  useEffect(() => {
    setForceUpdate(prev => prev + 1)
  }, [])

  // Add social media entry
  const addSocialMedia = () => {
    const newSocialMedia = [...socialList, { 
      platform: "", 
      url: "",
      handle: "",
      phone: "",
      phoneCode: "+1",
      inviteCode: "",
      channelId: ""
    }]
    setSocialList(newSocialMedia)
    form.setValue("social_media", newSocialMedia)
    setForceUpdate(prev => prev + 1)
  }

  // Remove social media entry
  const removeSocialMedia = (index: number) => {
    const newSocialMedia = socialList.filter((_, i) => i !== index)
    setSocialList(newSocialMedia)
    form.setValue("social_media", newSocialMedia)
    setForceUpdate(prev => prev + 1)
  }

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
        {socialList.map((social, index) => {
          const platformConfig = getPlatformFields(social.platform);
          
          return (
            <div key={`social-row-${index}-${forceUpdate}`} className="space-y-4">
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
                        onValueChange={(value) => {
                          field.onChange(value)
                          const newSocialMedia = [...socialList]
                          newSocialMedia[index] = { ...newSocialMedia[index], platform: value }
                          setSocialList(newSocialMedia)
                          setForceUpdate(prev => prev + 1)
                        }}
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
                                onValueChange={(value) => {
                                  field.onChange(value)
                                  const newSocialMedia = [...socialList]
                                  newSocialMedia[index] = { ...newSocialMedia[index], phoneCode: value }
                                  setSocialList(newSocialMedia)
                                }}
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
                                    onChange={(e) => {
                                      field.onChange(e)
                                      const newSocialMedia = [...socialList]
                                      newSocialMedia[index] = { ...newSocialMedia[index], phone: e.target.value }
                                      setSocialList(newSocialMedia)
                                    }}
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
                                    onChange={(e) => {
                                      field.onChange(e)
                                      const newSocialMedia = [...socialList]
                                      newSocialMedia[index] = { ...newSocialMedia[index], handle: e.target.value }
                                      setSocialList(newSocialMedia)
                                    }}
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
                                  onChange={(e) => {
                                    field.onChange(e)
                                    const newSocialMedia = [...socialList]
                                    newSocialMedia[index] = { ...newSocialMedia[index], url: e.target.value }
                                    setSocialList(newSocialMedia)
                                  }}
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
                                    onChange={(e) => {
                                      field.onChange(e)
                                      const newSocialMedia = [...socialList]
                                      newSocialMedia[index] = { ...newSocialMedia[index], inviteCode: e.target.value }
                                      setSocialList(newSocialMedia)
                                    }}
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
                                  onChange={(e) => {
                                    field.onChange(e)
                                    const newSocialMedia = [...socialList]
                                    newSocialMedia[index] = { ...newSocialMedia[index], url: e.target.value }
                                    setSocialList(newSocialMedia)
                                  }}
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
                                    onChange={(e) => {
                                      field.onChange(e)
                                      const newSocialMedia = [...socialList]
                                      newSocialMedia[index] = { ...newSocialMedia[index], url: e.target.value }
                                      setSocialList(newSocialMedia)
                                    }}
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
                                  onChange={(e) => {
                                    field.onChange(e)
                                    const newSocialMedia = [...socialList]
                                    newSocialMedia[index] = { ...newSocialMedia[index], handle: e.target.value }
                                    setSocialList(newSocialMedia)
                                  }}
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