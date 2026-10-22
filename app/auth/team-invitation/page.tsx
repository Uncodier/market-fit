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
import { useLocalization } from '@/app/context/LocalizationContext'

const invitationErrorKeys: Record<string, string> = {
  'Please authenticate before accepting the invitation': 'auth.flows.invitation.authRequired',
  'Invalid invitation link': 'auth.flows.invitation.invalidLink',
  'Failed to verify the invitation': 'auth.flows.invitation.verifyFailed',
  'This invitation was not issued to your account': 'auth.flows.invitation.wrongAccount',
  'This invitation is no longer active': 'auth.flows.invitation.inactive',
  'Site not found or access denied': 'auth.flows.invitation.siteUnavailable',
  'The invitation could not be activated': 'auth.flows.invitation.activationFailed',
}

const invitationRoleKeys: Record<string, string> = {
  owner: 'auth.flows.invitation.role.owner',
  admin: 'auth.flows.invitation.role.admin',
  manager: 'auth.flows.invitation.role.manager',
  marketing: 'auth.flows.invitation.role.marketing',
  collaborator: 'auth.flows.invitation.role.collaborator',
  viewer: 'auth.flows.invitation.role.viewer',
  view: 'auth.flows.invitation.role.view',
  create: 'auth.flows.invitation.role.create',
  delete: 'auth.flows.invitation.role.delete',
}

function TeamInvitationContent() {
  const { t } = useLocalization()
  const translate = useRef(t)
  useEffect(() => { translate.current = t }, [t])
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isProcessing, setIsProcessing] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const attemptedInvitation = useRef<string | null>(null)
  const processing = useRef(false)
  const [processingResult, setProcessingResult] = useState<{
    success: boolean
    error?: string
    errorKey?: string
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
          errorKey: 'auth.flows.invitation.missingParameters'
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

        const errorKey = result.error
          ? invitationErrorKeys[result.error] || 'auth.flows.invitation.failed'
          : undefined
        setProcessingResult({ ...result, errorKey })

        if (result.upgradeRequired) {
          setUpgradeOpen(true)
        } else if (result.success && result.redirectTo) {
          toast.success(translate.current('auth.flows.invitation.successToast', { siteName }))
          // Redirect after a short delay to show the success message
          setTimeout(() => {
            router.push(result.redirectTo!)
          }, 2000)
        } else if (result.error) {
          toast.error(translate.current(errorKey!))
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
          errorKey: 'auth.flows.invitation.unexpectedError'
        })
        toast.error(translate.current('auth.flows.invitation.failedToast'))
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
          <CardTitle className="text-xl">{t('auth.flows.invitation.title')}</CardTitle>
          {siteName && (
            <p className="text-sm text-muted-foreground">
              {t('auth.flows.invitation.invitedTo')}{' '}<span className="font-medium">{siteName}</span>
            </p>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          {isProcessing && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-3">
                <div className="w-8 h-8 mx-auto animate-pulse bg-primary/20 rounded-full" />
                <p className="text-sm text-muted-foreground">
                  {t('auth.flows.invitation.processing')}
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
                    <h3 className="font-medium text-foreground">{t('auth.flows.invitation.welcome')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t('auth.flows.invitation.addedTo', { siteName: siteName || '' })}
                    </p>
                    {processingResult.redirectTo && (
                      <p className="text-xs text-muted-foreground">
                        {t('auth.flows.invitation.redirecting')}
                      </p>
                    )}
                  </div>
                  {!processingResult.redirectTo && (
                    <Button onClick={handleGoToDashboard} className="w-full">
                      {t('auth.flows.goToDashboard')}
                    </Button>
                  )}
                </>
              ) : processingResult.upgradeRequired ? (
                <>
                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">{t('auth.flows.invitation.moreSeats')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {processingResult.upgradeRequired.canUpgrade
                        ? t('auth.flows.invitation.upgradeSite')
                        : processingResult.upgradeRequired.requiredPlan
                          ? t('auth.flows.invitation.askOwnerPlan', { plan: licensePlanLabel(processingResult.upgradeRequired.requiredPlan) })
                          : t('auth.flows.invitation.askOwner')}
                      {' '}{t('auth.flows.invitation.notAccepted')}
                    </p>
                  </div>
                  <Button onClick={() => setUpgradeOpen(true)} variant="outline" className="w-full">{t('auth.flows.invitation.viewLicense')}</Button>
                  <Button onClick={handleRetry} className="w-full">{t('auth.flows.invitation.retryUpgrade')}</Button>
                </>
              ) : (
                <>
                  <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-destructive" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">{t('auth.flows.invitation.errorTitle')}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t(processingResult.errorKey || 'auth.flows.invitation.failed')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Button onClick={handleRetry} variant="outline" className="w-full">
                      {t('auth.flows.tryAgain')}
                    </Button>
                    <Button onClick={handleGoToDashboard} variant="ghost" className="w-full">
                      {t('auth.flows.goToDashboard')}
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
                    <span className="text-muted-foreground">{t('auth.flows.invitation.roleLabel')}</span>{' '}
                    <span className="font-medium capitalize">{invitationRoleKeys[role] ? t(invitationRoleKeys[role]) : role}</span>
                  </p>
                )}
                {name && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">{t('auth.flows.invitation.nameLabel')}</span>{' '}
                    <span className="font-medium">{name}</span>
                  </p>
                )}
                {position && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">{t('auth.flows.invitation.positionLabel')}</span>{' '}
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
  const { t } = useLocalization()
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl">{t('auth.flows.invitation.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 mx-auto animate-pulse bg-primary/20 rounded-full" />
              <p className="text-sm text-muted-foreground">
                {t('auth.flows.invitation.loading')}
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