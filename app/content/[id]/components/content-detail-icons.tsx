import {
  FileText,
  FileVideo,
  Globe,
} from "@/app/components/ui/icons"

type IconProps = { className?: string; size?: number }

function CustomIcon({
  className = "",
  size = 20,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <div
      className={`inline-flex items-center justify-center safari-icon-fix ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </div>
  )
}

export function ContentStatusIcon({ className }: { className?: string }) {
  return (
    <CustomIcon className={className}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </CustomIcon>
  )
}

const Podcast = (props: IconProps) => (
  <CustomIcon {...props}>
    <circle cx="12" cy="12" r="2" />
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
  </CustomIcon>
)

const Newsletter = (props: IconProps) => (
  <CustomIcon {...props}>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22 6 12 13 2 6" />
  </CustomIcon>
)

const CaseStudy = (props: IconProps) => (
  <CustomIcon {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </CustomIcon>
)

const Whitepaper = (props: IconProps) => (
  <CustomIcon {...props}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="12" y1="9" x2="8" y2="9" />
  </CustomIcon>
)

const Infographic = (props: IconProps) => (
  <CustomIcon {...props}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </CustomIcon>
)

const Webinar = (props: IconProps) => (
  <CustomIcon {...props}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    <circle cx="12" cy="8" r="2" />
  </CustomIcon>
)

const Ebook = (props: IconProps) => (
  <CustomIcon {...props}>
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </CustomIcon>
)

const Advertisement = (props: IconProps) => (
  <CustomIcon {...props}>
    <path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z" />
    <path d="M11 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z" />
    <path d="M19 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z" />
  </CustomIcon>
)

const LandingPage = (props: IconProps) => (
  <CustomIcon {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <rect x="7" y="7" width="3" height="9" />
    <rect x="14" y="7" width="3" height="5" />
  </CustomIcon>
)

const SocialPost = (props: IconProps) => <Globe {...props} />

const TYPE_ICONS = {
  video: FileVideo,
  podcast: Podcast,
  social_post: SocialPost,
  newsletter: Newsletter,
  case_study: CaseStudy,
  whitepaper: Whitepaper,
  infographic: Infographic,
  webinar: Webinar,
  ebook: Ebook,
  ad: Advertisement,
  landing_page: LandingPage,
}

export function getContentTypeIcon(type: string) {
  const iconProps = { className: "h-4 w-4" }
  const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS] || FileText
  return <Icon {...iconProps} />
}

export function getNetworkIcon(network: string) {
  switch (network.toLowerCase()) {
    case "linkedin":
    case "linkedin_profile":
    case "linkedin_page":
      return <svg className="h-4 w-4 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
    case "facebook":
    case "facebook_page":
      return <svg className="h-4 w-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
    case "x":
    case "twitter":
      return <svg className="h-3.5 w-3.5 text-gray-900 dark:text-gray-100" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
    case "instagram":
      return <svg className="h-4 w-4 text-[#E1306C]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12 2c2.72 0 3.06.01 4.12.06 1.06.05 1.79.22 2.43.47a4.9 4.9 0 0 1 1.77 1.15 4.9 4.9 0 0 1 1.15 1.77c.25.64.42 1.37.47 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12c-.05 1.06-.22 1.79-.47 2.43a4.9 4.9 0 0 1-1.15 1.77 4.9 4.9 0 0 1-1.77 1.15c-.64.25-1.37.42-2.43.47-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06c-1.06-.05-1.79-.22-2.43-.47a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.25-.64-.42-1.37-.47-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.06.22-1.79.47-2.43a4.9 4.9 0 0 1 1.15-1.77 4.9 4.9 0 0 1 1.77-1.15c.64-.25 1.37-.42 2.43-.47C8.94 2.01 9.28 2 12 2zm0 4.87A5.13 5.13 0 1 0 12 17.13 5.13 5.13 0 0 0 12 6.87zm5.34-1.41a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM12 8.67a3.33 3.33 0 1 1 0 6.66 3.33 3.33 0 0 1 0-6.66z" clipRule="evenodd" /></svg>
    default:
      return <Globe className="h-4 w-4 text-muted-foreground" />
  }
}
