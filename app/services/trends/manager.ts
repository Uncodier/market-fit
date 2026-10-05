import type {
  AggregatedTrendsResponse, TrendFetchOptions, TrendItem, TrendPlatform,
  TrendResponse, TrendSegment, TrendService, TrendSortBy,
} from '@/app/types/trends'
import { generateCommercialKeywords } from './commercial-keywords'
import { GoogleTrendsService } from './google-service'
import { failedTrendResponse } from './provider-request'
import { RedditTrendsService } from './reddit-service'
import { enhanceRelevanceScoring } from './relevance'
import { normalizeLimit, normalizeScoringSegments } from './request-normalization'
import { calculateAdvancedScoring } from './scoring'
import { TwitterTrendsService } from './twitter-service'

export class TrendsManager {
  private services: Map<TrendPlatform, TrendService>

  constructor() {
    this.services = new Map<TrendPlatform, TrendService>([
      ['google', new GoogleTrendsService({ limit: 15 })],
      ['reddit', new RedditTrendsService({ limit: 15 })],
      ['twitter', new TwitterTrendsService({ limit: 15 })],
    ])
  }

  async getTrends(platform: TrendPlatform, segments?: TrendSegment[], limit?: number, options: TrendFetchOptions = {}): Promise<TrendResponse> {
    const service = this.services.get(platform)
    if (!service?.isEnabled) {
      return failedTrendResponse(platform, `Platform ${platform} is not available`)
    }
    try {
      // Pass limits per-call; mutating shared service config would race differing requests.
      return await service.fetchTrends(segments, { ...options, limit: limit ?? options.limit })
    } catch {
      return failedTrendResponse(platform)
    }
  }

  async getAllTrends(
    platforms?: TrendPlatform[],
    segments?: TrendSegment[],
    options: { limitPerPlatform?: number; sortBy?: TrendSortBy; forceRefresh?: boolean } = {},
  ): Promise<AggregatedTrendsResponse> {
    const enabledPlatforms = Array.from(new Set(platforms ?? this.getEnabledPlatforms()))
    if (enabledPlatforms.length === 0) return { success: false, error: 'No trend platforms are enabled' }
    const limitPerPlatform = normalizeLimit(options.limitPerPlatform, 6)
    const sortBy = options.sortBy ?? 'relevance'
    try {
      const results = await Promise.all(enabledPlatforms.map(platform =>
        this.getTrends(platform, segments, limitPerPlatform, { forceRefresh: options.forceRefresh }),
      ))
      const successfulPlatforms: TrendPlatform[] = []
      const platformErrors: Partial<Record<TrendPlatform, string>> = {}
      let allTrends: TrendItem[] = []
      results.forEach(result => {
        if (result.success && result.data) {
          successfulPlatforms.push(result.platform)
          allTrends.push(...result.data)
        } else {
          platformErrors[result.platform] = result.error ?? `Failed to fetch ${result.platform} trends`
        }
      })
      if (successfulPlatforms.length === 0) {
        return {
          success: false,
          error: `Unable to load trends. ${Object.values(platformErrors).join('; ')}`,
          platformErrors,
        }
      }
      // Preserve the existing commercial relevance filter and advanced ranking.
      const scoringSegments = normalizeScoringSegments(segments)
      if (scoringSegments.length) {
        allTrends = enhanceRelevanceScoring(allTrends, scoringSegments, generateCommercialKeywords(scoringSegments))
      }
      allTrends = calculateAdvancedScoring(allTrends)
      allTrends.sort((a, b) => compareTrends(a, b, sortBy))
      const trendsByPlatform = new Map<TrendPlatform, TrendItem[]>()
      for (const trend of allTrends) {
        const group = trendsByPlatform.get(trend.platform) ?? []
        if (group.length < limitPerPlatform) group.push(trend)
        trendsByPlatform.set(trend.platform, group)
      }
      allTrends = Array.from(trendsByPlatform.values()).flat()
      return {
        success: true,
        ...(Object.keys(platformErrors).length ? { platformErrors } : {}),
        data: {
          trends: allTrends,
          platforms: successfulPlatforms,
          totalCount: allTrends.length,
          lastUpdated: new Date().toISOString(),
          sortBy,
          analytics: {
            hotTrends: allTrends.filter(t => t.hotnessRating === 'very-hot' || t.hotnessRating === 'hot').length,
            viralTrends: allTrends.filter(t => t.viralRating === 'very-viral' || t.viralRating === 'viral').length,
            crossPlatformTrends: allTrends.filter(t => (t.crossPlatformTopics?.length ?? 0) > 0).length,
            highImpactTrends: allTrends.filter(t => t.impactRating === 'high-impact').length,
          },
        },
      }
    } catch {
      return { success: false, error: 'Failed to fetch trends' }
    }
  }

  getEnabledPlatforms(): TrendPlatform[] {
    return Array.from(this.services.keys()).filter(platform => this.services.get(platform)?.isEnabled)
  }

  enablePlatform(platform: TrendPlatform, enabled = true) {
    const service = this.services.get(platform)
    if (service) service.isEnabled = enabled
  }
}

function compareTrends(a: TrendItem, b: TrendItem, sortBy: TrendSortBy): number {
  switch (sortBy) {
    case 'hotness': return (b.hotnessScore ?? 0) - (a.hotnessScore ?? 0)
    case 'viral': return (b.viralPotential ?? 0) - (a.viralPotential ?? 0)
    case 'impact': return (b.impactScore ?? 0) - (a.impactScore ?? 0)
    case 'cross-platform':
      return ((b.crossPlatformBonus ?? 0) + (b.crossPlatformTopics?.length ?? 0) * 10)
        - ((a.crossPlatformBonus ?? 0) + (a.crossPlatformTopics?.length ?? 0) * 10)
    case 'recent': return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    default: return (b.relevanceScore || b.score || 0) - (a.relevanceScore || a.score || 0)
  }
}