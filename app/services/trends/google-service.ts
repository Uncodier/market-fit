import type { GoogleTrendsConfig, TrendFetchOptions, TrendPlatform, TrendSegment, TrendService } from '@/app/types/trends'
import { ProviderRequests } from './provider-request'
import { normalizeLimit, normalizeSegments } from './request-normalization'
import { number, record, strings, text } from './response-fields'

export class GoogleTrendsService implements TrendService {
  platform: TrendPlatform = 'google'
  isEnabled = true
  config: GoogleTrendsConfig
  private requests = new ProviderRequests('google')

  constructor(config: GoogleTrendsConfig = {}) {
    this.config = { geo: 'US', hl: 'en', timeframe: 'now 1-d', limit: 10, ...config }
  }

  fetchTrends(segments?: TrendSegment[], options: TrendFetchOptions = {}) {
    const { geo, hl, timeframe } = this.config
    const payload = {
      geo, hl, timeframe,
      limit: normalizeLimit(options.limit ?? this.config.limit),
      segments: normalizeSegments(segments ?? this.config.segments, 5),
      mode: 'news',
    }
    // Google generates its queries on the server; it does not accept keywords.
    return this.requests.fetch(payload, items => items.flatMap((item, index) => {
      const news = record(item)
      const title = text(news.title) ?? text(news.headline)
      if (!title) return []
      const url = text(news.url) ?? text(news.link)
      return [{
        id: `google-news-${url ?? title}-${index}`,
        title,
        description: text(news.description) ?? text(news.snippet) ?? text(news.summary),
        score: number(news.relevance_score) ?? number(news.engagement),
        change: number(news.trend_change),
        platform: 'google' as const,
        category: text(news.category) ?? text(news.section),
        tags: strings(news.tags ?? news.keywords),
        url,
        relatedKeywords: strings(news.keywords ?? news.tags),
        region: geo,
        timestamp: text(news.published_at) ?? new Date().toISOString(),
        metadata: {
          source: text(news.source) ?? text(news.publisher),
          published_at: news.published_at,
          author: news.author,
          news_type: 'business_tech',
          geo, timeframe,
          is_breaking: news.is_breaking ?? false,
          engagement_score: news.engagement,
        },
      }]
    }), options).then(response => ({ ...response, region: geo }))
  }
}