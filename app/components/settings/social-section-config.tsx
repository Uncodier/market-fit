import type { ComponentType } from "react"
import {
  BlueskyIcon,
  FacebookIcon,
  GlobeIcon,
  InstagramIcon,
  LinkedInIcon,
  PinterestIcon,
  ThreadsIcon,
  TikTokIcon,
  TwitterIcon,
  YouTubeIcon,
} from "../ui/social-icons"

type SocialPlatformIcon = ComponentType<{
  className?: string
  size?: number
}>

export interface SocialPlatformOption {
  value: string
  label: string
  icon: SocialPlatformIcon
}

export const SOCIAL_PLATFORMS: SocialPlatformOption[] = [
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

// Instagram remains in the complete list so existing accounts keep their label and icon.
export const NEW_ACCOUNT_SOCIAL_PLATFORMS = SOCIAL_PLATFORMS.filter(
  ({ value }) => value !== "instagram"
)

const OAUTH_CONNECT_PLATFORM_VALUES = new Set([
  "facebook",
  "instagram",
  "threads",
  "twitter",
  "x",
  "youtube",
  "tiktok",
  "linkedin",
  "pinterest",
])

export function isOAuthConnectablePlatform(platform: string | undefined): boolean {
  return !!platform && OAUTH_CONNECT_PLATFORM_VALUES.has(platform)
}

export function getPlatformIcon(platform: string | undefined, size = 16) {
  if (!platform) return <GlobeIcon size={size} />

  switch (platform.toLowerCase()) {
    case "facebook":
      return <FacebookIcon size={size} />
    case "twitter":
    case "x":
      return <TwitterIcon size={size} />
    case "instagram":
      return <InstagramIcon size={size} />
    case "threads":
      return <ThreadsIcon size={size} />
    case "linkedin":
      return <LinkedInIcon size={size} />
    case "youtube":
      return <YouTubeIcon size={size} />
    case "tiktok":
      return <TikTokIcon size={size} />
    case "pinterest":
      return <PinterestIcon size={size} />
    case "bluesky":
      return <BlueskyIcon size={size} />
    default:
      return <GlobeIcon size={size} />
  }
}

export const COUNTRY_CODES = [
  { value: "+1", label: "+1 (US/Canada)" },
  { value: "+52", label: "+52 (Mexico)" },
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
  { value: "+20", label: "+20 (Egypt)" },
  { value: "+27", label: "+27 (South Africa)" },
  { value: "+234", label: "+234 (Nigeria)" },
  { value: "+254", label: "+254 (Kenya)" },
  { value: "+212", label: "+212 (Morocco)" },
  { value: "+216", label: "+216 (Tunisia)" },
  { value: "+233", label: "+233 (Ghana)" },
  { value: "+61", label: "+61 (Australia)" },
  { value: "+64", label: "+64 (New Zealand)" },
  { value: "+679", label: "+679 (Fiji)" },
]

export function getPlatformFields(platform: string) {
  switch (platform) {
    case "whatsapp":
      return {
        fields: ["phone", "phoneCode"],
        labels: {
          phone: "Phone Number",
          phoneCode: "Country Code",
        },
        placeholders: {
          phone: "123456789",
        },
      }
    case "telegram":
      return {
        fields: ["handle", "url"],
        labels: {
          handle: "Username",
          url: "Invite Link",
        },
        placeholders: {
          handle: "@username",
          url: "https://t.me/username",
        },
      }
    case "discord":
      return {
        fields: ["inviteCode", "url"],
        labels: {
          inviteCode: "Invite Code",
          url: "Server URL",
        },
        placeholders: {
          inviteCode: "discord-invite-code",
          url: "https://discord.gg/code",
        },
      }
    default:
      return {
        fields: ["url", "handle"],
        labels: {
          url: "URL",
          handle: "Username",
        },
        placeholders: {
          url: "https://example.com/profile",
          handle: "@username",
        },
      }
  }
}
