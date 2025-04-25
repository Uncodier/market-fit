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

// Función para obtener el componente de ícono según la plataforma
const getPlatformIcon = (platform: string | undefined, size: number = 16) => {
  if (!platform) return <GlobeIcon size={size} />;
  
  console.log("getPlatformIcon called with platform:", platform, "type:", typeof platform);
  
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
    default: 
      console.log("No case matched for platform:", platform, "falling back to GlobeIcon");
      return <GlobeIcon size={size} />;
  }
};

// Muestra un grid de todos los íconos disponibles
const SocialIconsGrid = ({ size = 24 }: { size?: number }) => {
  return (
    <div className="mt-8 p-4 bg-muted/30 rounded-md">
      <h3 className="mb-4 text-sm font-medium">Available platforms</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {SOCIAL_PLATFORMS.map((platform) => (
          <div 
            key={platform.value}
            className="flex flex-col items-center gap-1 p-2 border rounded-md"
            title={platform.label}
          >
            {getPlatformIcon(platform.value, size)}
            <span className="text-xs">{platform.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface SocialSectionProps {
  active: boolean
}

export function SocialSection({ active }: SocialSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [socialList, setSocialList] = useState<{platform: string, url: string, handle?: string}[]>(
    form.getValues("social_media") || []
  )
  const [forceUpdate, setForceUpdate] = useState(0)

  // Force re-render on component mount
  useEffect(() => {
    setForceUpdate(prev => prev + 1)
  }, [])

  // Add social media entry
  const addSocialMedia = () => {
    const newSocialMedia = [...socialList, { platform: "", url: "", handle: "" }]
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
        {socialList.map((social, index) => (
          <div key={`social-row-${index}-${forceUpdate}`} className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <FormField
              control={form.control}
              name={`social_media.${index}.platform`}
              render={({ field }) => (
                <FormItem className="md:col-span-1">
                  <FormLabel className={index !== 0 ? "sr-only" : undefined}>
                    Platform
                  </FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value)
                      const newSocialMedia = [...socialList]
                      newSocialMedia[index].platform = value
                      setSocialList(newSocialMedia)
                      setForceUpdate(prev => prev + 1)
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select platform">
                          {field.value && (
                            <div className="flex items-center gap-2">
                              {getPlatformIcon(field.value, 16)}
                              <span>{SOCIAL_PLATFORMS.find(p => p.value === field.value)?.label || field.value}</span>
                            </div>
                          )}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
            <FormField
              control={form.control}
              name={`social_media.${index}.url`}
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel className={index !== 0 ? "sr-only" : undefined}>URL</FormLabel>
                  <FormControl>
                    <div className="flex items-center relative">
                      {social.platform && (
                        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                          {getPlatformIcon(social.platform, 16)}
                        </div>
                      )}
                      <Input
                        placeholder="https://example.com/profile"
                        {...field}
                        className={social.platform ? "pl-9" : ""}
                        onChange={(e) => {
                          field.onChange(e)
                          const newSocialMedia = [...socialList]
                          newSocialMedia[index].url = e.target.value
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
                <FormItem className="md:col-span-1">
                  <FormLabel className={index !== 0 ? "sr-only" : undefined}>
                    Handle
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="@username"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        const newSocialMedia = [...socialList]
                        newSocialMedia[index].handle = e.target.value
                        setSocialList(newSocialMedia)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-end justify-center md:justify-start">
              <Button
                size="icon"
                variant="ghost"
                type="button"
                onClick={() => removeSocialMedia(index)}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ))}
        
        <Button
          variant="outline"
          className="mt-2"
          type="button"
          onClick={addSocialMedia}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Social Network
        </Button>
        
        {socialList.filter(social => social.platform && social.url).length > 0 && (
          <div className="flex flex-wrap gap-4 mt-6">
            {socialList.filter(social => social.platform && social.url).map((social, index) => (
              <div key={`preview-${social.platform}-${index}-${forceUpdate}`} className="flex items-center p-2 border rounded-md hover:bg-muted/50 transition-colors">
                {getPlatformIcon(social.platform, 20)}
                <span className="ml-2 text-sm font-medium">{SOCIAL_PLATFORMS.find(p => p.value === social.platform)?.label || social.platform}</span>
              </div>
            ))}
          </div>
        )}
        
        <div className="text-sm text-muted-foreground mt-4">
          <p>Connect your social media accounts to enhance your site's presence. Only accounts with valid URLs will be saved.</p>
        </div>
        
        {/* Muestra todos los íconos disponibles */}
        <SocialIconsGrid />
      </CardContent>
    </Card>
  )
} 