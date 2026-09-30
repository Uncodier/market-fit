import { buildSocialPerformanceReport } from "@/app/components/dashboard/social-metrics"
import { performancePost, startDate, endDate } from "./social-fixtures"

export function socialReportFixture(views = 300, comments = 2) {
  return buildSocialPerformanceReport([performancePost({
    views, comments,
    metrics_by_account: [{ account_id: "account-1", network: "instagram", views, likes: 10, comments, reach: 80 }],
  })], startDate, endDate)
}