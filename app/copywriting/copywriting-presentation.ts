import { FileText,Globe,Hash,Mail,MessageSquare,PenTool,Phone,Target } from "@/app/components/ui/icons"

// Copywriting types
export const COPYWRITING_TYPES = [
  { id: 'tweet', label: 'Tweet', icon: Hash },
  { id: 'pitch', label: 'Pitch', icon: Target },
  { id: 'blurb', label: 'Blurb', icon: FileText },
  { id: 'cold_email', label: 'Cold Email', icon: Mail },
  { id: 'cold_call', label: 'Cold Call Script', icon: Phone },
  { id: 'social_post', label: 'Social Media Post', icon: MessageSquare },
  { id: 'ad_copy', label: 'Ad Copy', icon: Globe },
  { id: 'headline', label: 'Headline', icon: PenTool },
  { id: 'description', label: 'Product Description', icon: FileText },
  { id: 'landing_page', label: 'Landing Page Copy', icon: Globe }
] as const

const getCopywritingTypes = (t: (key: string) => string) => [
  { id: 'tweet', label: t('copywriting.types.tweet') || 'Tweet', icon: Hash },
  { id: 'pitch', label: t('copywriting.types.pitch') || 'Pitch', icon: Target },
  { id: 'blurb', label: t('copywriting.types.blurb') || 'Blurb', icon: FileText },
  { id: 'cold_email', label: t('copywriting.types.coldEmail') || 'Cold Email', icon: Mail },
  { id: 'cold_call', label: t('copywriting.types.coldCall') || 'Cold Call Script', icon: Phone },
  { id: 'social_post', label: t('copywriting.types.socialPost') || 'Social Media Post', icon: MessageSquare },
  { id: 'ad_copy', label: t('copywriting.types.adCopy') || 'Ad Copy', icon: Globe },
  { id: 'headline', label: t('copywriting.types.headline') || 'Headline', icon: PenTool },
  { id: 'description', label: t('copywriting.types.description') || 'Product Description', icon: FileText },
  { id: 'landing_page', label: t('copywriting.types.landingPage') || 'Landing Page Copy', icon: Globe }
] as const

export type CopywritingType = typeof COPYWRITING_TYPES[number]['id']

export const COPYWRITING_STATUS = [
  'pending',
  'in_progress', 
  'completed',
  'published',
  'archived'
] as const

export type CopywritingStatus = typeof COPYWRITING_STATUS[number]

export interface CopywritingFilters {
  status: CopywritingStatus[]
  type: CopywritingType[]
  segments: string[]
}

export function getCopywritingIcon(type: CopywritingType) {
  const typeConfig = COPYWRITING_TYPES.find(t => t.id === type)
  return typeConfig?.icon || FileText
}

export function getCopywritingStatusColor(status: CopywritingStatus): string {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'published':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'archived':
      return 'bg-gray-100 text-gray-800 border-gray-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

// Skeleton component
