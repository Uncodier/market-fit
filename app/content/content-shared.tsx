"use client"

import React from "react"
import { FileText, FileVideo, MessageSquare, Globe, Mail, BarChart, LayoutGrid, PlayCircle } from "@/app/components/ui/icons"

export const CONTENT_STATUSES = [
  { id: "draft" },
  { id: "review" },
  { id: "approved" },
  { id: "published" },
  { id: "archived" },
]

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  published: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  archived: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
}

export const CONTENT_TYPE_ICONS: Record<string, React.ReactElement> = {
  blog_post: <FileText className="h-4 w-4" />,
  video: <FileVideo className="h-4 w-4" />,
  podcast: <MessageSquare className="h-4 w-4" />,
  social_post: <Globe className="h-4 w-4" />,
  newsletter: <Mail className="h-4 w-4" />,
  case_study: <FileText className="h-4 w-4" />,
  whitepaper: <FileText className="h-4 w-4" />,
  infographic: <BarChart className="h-4 w-4" />,
  webinar: <PlayCircle className="h-4 w-4" />,
  ebook: <FileText className="h-4 w-4" />,
  ad: <LayoutGrid className="h-4 w-4" />,
  landing_page: <LayoutGrid className="h-4 w-4" />,
}

export interface ContentFilters {
  status: string[]
  type: string[]
  segments: string[]
}

export function getNetworkIcon(network: string) {
  switch (network.toLowerCase()) {
    case "linkedin":
    case "linkedin_profile":
    case "linkedin_page":
      return <svg className="w-4 h-4 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
    case "facebook":
    case "facebook_page":
      return <svg className="w-4 h-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd"/></svg>
    case "x":
    case "twitter":
      return <svg className="w-3.5 h-3.5 text-gray-900 dark:text-gray-100" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    case "instagram":
      return <svg className="w-4 h-4 text-[#E1306C]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd"/></svg>
    case "tiktok":
      return <svg className="w-4 h-4 text-gray-900 dark:text-gray-100" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 2.22-1.15 4.54-2.97 5.86-1.53 1.1-3.53 1.4-5.38.99-1.83-.41-3.41-1.73-4.14-3.45-.73-1.74-.6-3.79.3-5.39.95-1.68 2.76-2.73 4.69-2.83V16.1c-.81.04-1.62.24-2.28.73-.66.5-1.08 1.26-1.19 2.08-.13.91.13 1.88.75 2.51.62.63 1.58.9 2.48.79.88-.11 1.65-.67 2.02-1.45.35-.74.37-1.6.38-2.43V0h3.5v.02z"/></svg>
    default:
      return <Globe className="w-4 h-4 text-muted-foreground" />
  }
}
