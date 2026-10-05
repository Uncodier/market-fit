import { Alert, AlertDescription, AlertTitle } from "@/app/components/ui/alert"
import { Button } from "@/app/components/ui/button"
import { RotateCcw, TrendingUp } from "@/app/components/ui/icons"
import type { AggregatedTrendsResponse, TrendPlatform } from "@/app/types/trends"
import { TRENDS_PLATFORMS } from "./trends-presentation"

const PLATFORM_NAMES: Record<TrendPlatform, string> = {
  google: 'Google Trends', reddit: 'Reddit', twitter: 'Twitter', linkedin: 'LinkedIn',
  tiktok: 'TikTok', youtube: 'YouTube', instagram: 'Instagram'
}

export function TrendsAvailability({ platformErrors, error, failed }: {
  platformErrors: NonNullable<AggregatedTrendsResponse['platformErrors']>
  error?: string
  failed: boolean
}) {
  const failures = Object.entries(platformErrors).filter(([platform]) => TRENDS_PLATFORMS.includes(platform as TrendPlatform))
  if (!failed && failures.length === 0) return null
  return (
    <Alert role="status" aria-live="polite" className="mb-3">
      <AlertTitle>{failed ? 'Trends are unavailable' : 'Some trend providers are unavailable'}</AlertTitle>
      <AlertDescription>
        {failed && error && failures.length === 0 && <p>{error}</p>}
        {failures.length > 0 && (
          <ul className="space-y-1">
            {failures.map(([platform, message]) => (
              <li key={platform}><span className="font-medium">{PLATFORM_NAMES[platform as TrendPlatform]} unavailable:</span> {message}</li>
            ))}
          </ul>
        )}
        <p className="mt-2">{failed ? 'Please try again later.' : 'Results from available providers are shown below.'}</p>
      </AlertDescription>
    </Alert>
  )
}

export function TrendsEmptyState({ canRequest, failed, onRetry }: {
  canRequest: boolean
  failed: boolean
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="bg-muted/40 rounded-full flex items-center justify-center mb-4 h-[60px] w-[60px]">
        <TrendingUp className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="font-medium mb-2">{!canRequest ? 'Waiting for site context' : failed ? 'Unable to load trends' : 'No trends available'}</h3>
      <p className="text-sm text-muted-foreground text-center mb-4">
        {!canRequest ? 'Trends will load when your site and segments are ready.' : failed ? 'You can retry without leaving this page.' : 'No trending topics were found for this context.'}
      </p>
      {canRequest && <Button variant="outline" onClick={onRetry}><RotateCcw className="h-4 w-4 mr-2" />Try Again</Button>}
    </div>
  )
}