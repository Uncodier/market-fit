import type { TrendItem, TrendPlatform } from "@/app/types/trends"

export type TrendsSegments = Array<{ id: string; name: string; description?: string }>
export type TrendsSort = 'relevance' | 'hotness' | 'viral' | 'impact' | 'cross-platform' | 'recent'
export const TRENDS_PLATFORMS: TrendPlatform[] = ['google', 'reddit', 'twitter']

// Preserve each view's existing selection and ordering of successful results.
export function selectTrends(trends: TrendItem[], view: 'section' | 'column'): TrendItem[] {
  const grouped = trends.reduce((groups, trend) => {
    (groups[trend.platform] ??= []).push(trend)
    return groups
  }, {} as Partial<Record<TrendPlatform, TrendItem[]>>)

  if (view === 'section') {
    return Object.values(grouped).flatMap(items => items.slice(0, 10))
  }
  return TRENDS_PLATFORMS.flatMap(platform => (grouped[platform] ?? []).slice(0, 5))
    .sort((a, b) => (b.relevanceScore || b.score || 0) - (a.relevanceScore || a.score || 0))
}

// Plain text only; this is presentation cleanup, not an HTML sanitizer.
export function cleanHtmlContent(htmlString: string): string {
  if (!htmlString || typeof htmlString !== 'string') return ''
  return htmlString.trim()
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&hellip;/g, '...')
    .replace(/https?:\/\/[^\s]+/g, '')
    .replace(/\s*[-–—]\s*[A-Za-z\s]+\s*$/g, '')
    .replace(/^\s*[-–—]\s*/g, '')
    .replace(/\s+/g, ' ').trim()
}

export function formatLastUpdated(timestamp: string): string {
  if (!timestamp) return ''
  const minutes = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}