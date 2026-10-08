'use client'

import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { processTeamInvitation } from '@/app/services/magic-link-invitation-service'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { CheckCircle2, AlertCircle, Users } from '@/app/components/ui/icons'
import { toast } from 'sonner'
import { BillingLimitDialog } from '@/app/components/billing/billing-limit-dialog'
import { isBillingUpgradeRequired, type BillingLimitPayload } from '@/lib/billing-limit-errors'
import { licensePlanLabel } from '@/lib/license-entitlements'

function TeamInvitationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isProcessing, setIsProcessing] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const attemptedInvitation = useRef<string | null>(null)
  const processing = useRef(false)
  const [processingResult, setProcessingResult] = useState<{
    success: boolean
    error?: string
    redirectTo?: string
    upgradeRequired?: BillingLimitPayload
  } | null>(null)

  // Extract invitation parameters from URL
  const siteId = searchParams.get('siteId')
  const siteName = searchParams.get('siteName')
  const role = searchParams.get('role')
  const name = searchParams.get('name')
  const position = searchParams.get('position')
  const userEmail = searchParams.get('email') // This should come from the auth session
  
  const processInvitation = useCallback(async () => {
      if (processing.current) return
      if (!siteId || !siteName || !role) {
        setProcessingResult({
          success: false,
          error: 'Invalid invitation link. Missing required parameters.'
        })
        return
      }

      processing.current = true
      setIsProcessing(true)
      setProcessingResult(null)
      setUpgradeOpen(false)

      try {
        // The service will get the email from the authenticated user session
        // No need to pass userEmail since it will be obtained from auth
        const result = await processTeamInvitation({
          siteId,
          siteName,
          role,
          name: name || undefined,
          position: position || undefined,
          userEmail: userEmail || '' // This is optional now
        })

        setProcessingResult(result)

        if (result.upgradeRequired) {
          setUpgradeOpen(true)
        } else if (result.success && result.redirectTo) {
          toast.success(`Welcome to ${siteName}! You've been added to the team.`)
          // Redirect after a short delay to show the success message
          setTimeout(() => {
            router.push(result.redirectTo!)
          }, 2000)
        } else if (result.error) {
          toast.error(result.error)
        }

      } catch (error) {
        if (isBillingUpgradeRequired(error)) {
          setProcessingResult({ success: false, upgradeRequired: error.payload })
          setUpgradeOpen(true)
          return
        }
        console.error('Error processing invitation:', error)
        setProcessingResult({
          success: false,
          error: 'An unexpected error occurred while processing your invitation.'
        })
        toast.error('Failed to process invitation')
      } finally {
        processing.current = false
        setIsProcessing(false)
      }
  }, [siteId, siteName, role, name, position, userEmail, router])

  useEffect(() => {
    const invitationKey = JSON.stringify([siteId, siteName, role, name, position, userEmail])
    if (attemptedInvitation.current === invitationKey) return
    attemptedInvitation.current = invitationKey
    void processInvitation()
  }, [siteId, siteName, role, name, position, userEmail, processInvitation])

  const handleRetry = () => {
    void processInvitation()
  }

  const handleGoToDashboard = () => {
    router.push('/robots')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Team Invitation</CardTitle>
          {siteName && (
            <p className="text-sm text-muted-foreground">
              You&apos;ve been invited to join <span className="font-medium">{siteName}</span>
            </p>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isProcessing && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 mx-auto animate-pulse bg-primary/20 rounded-full" />
                <p className="text-sm text-muted-foreground">
                  Processing your invitation...
                </p>
              </div>
            </div>
          )}

          {processingResult && !isProcessing && (
            <div className="text-center space-y-4">
              {processingResult.success ? (
                <>
                  <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">Welcome to the team!</h3>
                    <p className="text-sm text-muted-foreground">
                      You&apos;ve been successfully added to {siteName}.
                    </p>
                    {processingResult.redirectTo && (
                      <p className="text-xs text-muted-foreground">
                        Redirecting you to the site dashboard...
                      </p>
                    )}
                  </div>
                  {!processingResult.redirectTo && (
                    <Button onClick={handleGoToDashboard} className="w-full">
                      Go to Dashboard
                    </Button>
                  )}
                </>
              ) : processingResult.upgradeRequired ? (
                <>
                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">More member seats needed</h3>
                    <p className="text-sm text-muted-foreground">
                      {processingResult.upgradeRequired.canUpgrade
                        ? 'Upgrade this site’s license, then retry this invitation.'
                        : `Ask the site owner to upgrade${processingResult.upgradeRequired.requiredPlan ? ` to ${licensePlanLabel(processingResult.upgradeRequired.requiredPlan)}` : ''}, then retry this invitation.`}
                      {' '}Your invitation has not been accepted yet.
                    </p>
                  </div>
                  <Button onClick={() => setUpgradeOpen(true)} variant="outline" className="w-full">View member license</Button>
                  <Button onClick={handleRetry} className="w-full">Retry after upgrade</Button>
                </>
              ) : (
                <>
                  <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-destructive" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">Invitation Error</h3>
                    <p className="text-sm text-muted-foreground">
                      {processingResult.error || 'Failed to process your invitation'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button onClick={handleRetry} variant="outline" className="w-full">
                      Try Again
                    </Button>
                    <Button onClick={handleGoToDashboard} variant="ghost" className="w-full">
                      Go to Dashboard
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Show invitation details while processing */}
          {(isProcessing || !processingResult) && (
            <div className="space-y-3 text-center">
              <div className="space-y-1">
                {role && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Role:</span>{' '}
                    <span className="font-medium capitalize">{role}</span>
                  </p>
                )}
                {name && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Name:</span>{' '}
                    <span className="font-medium">{name}</span>
                  </p>
                )}
                {position && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Position:</span>{' '}
                    <span className="font-medium">{position}</span>
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <BillingLimitDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} payload={processingResult?.upgradeRequired ?? null} />
    </div>
  )
}

// Loading fallback component
function TeamInvitationLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Team Invitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 mx-auto animate-pulse bg-primary/20 rounded-full" />
              <p className="text-sm text-muted-foreground">
                Loading invitation...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function TeamInvitationPage() {
  return (
    <Suspense fallback={<TeamInvitationLoading />}>
      <TeamInvitationContent />
    </Suspense>
  )
} 