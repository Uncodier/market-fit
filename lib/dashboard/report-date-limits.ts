export const DEFAULT_ANALYTICS_RANGE_DAYS = 93

export function analyticsMaxRangeDays(value = process.env.ANALYTICS_MAX_RANGE_DAYS): number {
  const days = Number(value)
  return Number.isSafeInteger(days) && days > 0 ? days : DEFAULT_ANALYTICS_RANGE_DAYS
}

// Keep the UI inside every API used by a section, including secondary metrics.
export function reportDateLimits(analyticsDays = analyticsMaxRangeDays()) {
  return {
    performance: { outcomes: analyticsDays, operations: analyticsDays, usage: analyticsDays },
    overview: { summary: analyticsDays, economics: analyticsDays, activity: analyticsDays },
    analytics: { distribution: analyticsDays, customers: Math.min(93, analyticsDays), leads: Math.min(93, analyticsDays) },
    traffic: { summary: analyticsDays, audience: analyticsDays, sessions: analyticsDays },
    sales: { summary: analyticsDays, channels: analyticsDays, categories: analyticsDays },
    costs: { summary: Math.min(366, analyticsDays), categories: 366 },
    social: { summary: 366, networks: 366, posts: 366 },
  }
}

export type ReportDateLimits = ReturnType<typeof reportDateLimits>