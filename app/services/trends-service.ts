import { TrendsManager } from './trends/manager'

// Keep the original public import surface after splitting implementation responsibilities.
export { TrendsManager }
export { GoogleTrendsService } from './trends/google-service'
export { RedditTrendsService } from './trends/reddit-service'
export const trendsManager = new TrendsManager()
