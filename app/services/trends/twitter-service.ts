import type { TrendFetchOptions, TrendPlatform, TrendSegment, TrendService, TwitterTrendsConfig } from '@/app/types/trends'
import { ProviderRequests } from './provider-request'
import { normalizeLimit } from './request-normalization'
import { number, record, text } from './response-fields'

export class TwitterTrendsService implements TrendService {
  platform: TrendPlatform = 'twitter'
  isEnabled = true
  config: TwitterTrendsConfig
  private requests = new ProviderRequests('twitter')

  constructor(config: TwitterTrendsConfig = {}) {
    this.config = { woeid: 1, limit: 15, ...config }
  }

  fetchTrends(_segments?: TrendSegment[], options: TrendFetchOptions = {}) {
    // The route accepts only location and limit, not segments or keywords.
    const payload = { woeid: this.config.woeid, limit: normalizeLimit(options.limit ?? this.config.limit) }
    return this.requests.fetch(payload, items => items.flatMap((item, index) => {
      const trend = record(item)
      const title = text(trend.name)
      if (!title) return []
      return [{
        id: `twitter-${title}-${index}`,
        title,
        score: number(trend.tweet_volume),
        platform: 'twitter' as const,
        category: 'Social',
        tags: [title.replace('#', '')],
        url: text(trend.url),
        relatedKeywords: [title],
        region: 'Global',
        timestamp: new Date().toISOString(),
        metadata: { tweet_volume: trend.tweet_volume, query: trend.query },
      }]
    }), options).then(response => ({ ...response, region: 'Global' }))
  }
}