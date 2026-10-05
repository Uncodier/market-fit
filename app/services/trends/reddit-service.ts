import type { RedditTrendsConfig, TrendFetchOptions, TrendPlatform, TrendSegment, TrendService } from '@/app/types/trends'
import { ProviderRequests } from './provider-request'
import { generateRedditKeywords } from './reddit-keywords'
import { normalizeKeywords, normalizeLimit, normalizeSegments } from './request-normalization'
import { number, record, strings, text } from './response-fields'

export class RedditTrendsService implements TrendService {
  platform: TrendPlatform = 'reddit'
  isEnabled = true
  config: RedditTrendsConfig
  private requests = new ProviderRequests('reddit')

  constructor(config: RedditTrendsConfig = {}) {
    this.config = { subreddit: 'all', sortBy: 'hot', timeframe: 'day', limit: 10, ...config }
  }

  fetchTrends(segments?: TrendSegment[], options: TrendFetchOptions = {}) {
    const normalizedSegments = normalizeSegments(segments ?? this.config.segments, 8)
    const payload = {
      subreddit: this.config.subreddit,
      sortBy: this.config.sortBy,
      timeframe: this.config.timeframe,
      limit: normalizeLimit(options.limit ?? this.config.limit),
      segments: normalizedSegments,
      keywords: normalizeKeywords(this.config.keywords ?? generateRedditKeywords(normalizedSegments)),
    }
    return this.requests.fetch(payload, items => items.flatMap((item, index) => {
      const trend = record(item)
      const title = text(trend.title)
      if (!title) return []
      const metadata = record(trend.metadata)
      const subreddit = text(metadata.subreddit)
      const comments = number(metadata.comments)
      const permalink = text(metadata.permalink)
      const created = number(metadata.created)
      return [{
        id: `reddit-${permalink ?? title}-${index}`,
        title,
        description: text(trend.description) ?? (
          subreddit ? `r/${subreddit}${comments !== undefined ? ` • ${comments} comments` : ''}` : undefined
        ),
        score: number(trend.value),
        change: number(trend.change),
        platform: 'reddit' as const,
        category: text(trend.category),
        tags: strings(trend.relatedQueries),
        url: permalink ? `https://www.reddit.com${permalink}` : text(metadata.url),
        relatedKeywords: strings(trend.relatedQueries),
        region: 'Global',
        timestamp: created !== undefined ? new Date(created * 1000).toISOString() : new Date().toISOString(),
        metadata: { ...metadata, subreddit, comments, permalink },
      }]
    }), options).then(response => ({ ...response, region: 'Global' }))
  }
}