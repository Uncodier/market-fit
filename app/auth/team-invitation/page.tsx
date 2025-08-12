'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { processTeamInvitation } from '@/app/services/magic-link-invitation-service'
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card'
import { Button } from '@/app/components/ui/button'
import { Loader, CheckCircle2, AlertCircle, Users } from '@/app/components/ui/icons'
import { toast } from 'sonner'
import { safeReload } from '@/app/utils/safe-reload'

function TeamInvitationContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingResult, setProcessingResult] = useState<{
    success: boolean
    error?: string
    redirectTo?: string
  } | null>(null)

  // Extract invitation parameters from URL
  const siteId = searchParams.get('siteId')
  const siteName = searchParams.get('siteName')
  const role = searchParams.get('role')
  const name = searchParams.get('name')
  const position = searchParams.get('position')
  const userEmail = searchParams.get('email') // This should come from the auth session
  
  console.log('🎯 Team invitation page params:', { siteId, siteName, role, name, position, userEmail })

  useEffect(() => {
    // Auto-process the invitation when the page loads
    const processInvitation = async () => {
      if (!siteId || !siteName || !role) {
        setProcessingResult({
          success: false,
          error: 'Invalid invitation link. Missing required parameters.'
        })
        return
      }

      setIsProcessing(true)

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

        if (result.success && result.redirectTo) {
          toast.success(`Welcome to ${siteName}! You've been added to the team.`)
          // Redirect after a short delay to show the success message
          setTimeout(() => {
            router.push(result.redirectTo!)
          }, 2000)
        } else if (result.error) {
          toast.error(result.error)
        }

      } catch (error) {
        console.error('Error processing invitation:', error)
        setProcessingResult({
          success: false,
          error: 'An unexpected error occurred while processing your invitation.'
        })
        toast.error('Failed to process invitation')
      } finally {
        setIsProcessing(false)
      }
    }

    processInvitation()
  }, [siteId, siteName, role, name, position, userEmail, router])

  const handleRetry = () => {
    setProcessingResult(null)
    safeReload(false, "Team invitation retry")
  }

  const handleGoToDashboard = () => {
    router.push('/dashboard')
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
              You've been invited to join <span className="font-medium">{siteName}</span>
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
                  <div className="mx-auto w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium text-green-900">Welcome to the team!</h3>
                    <p className="text-sm text-green-700">
                      You've been successfully added to {siteName}.
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
              ) : (
                <>
                  <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium text-red-900">Invitation Error</h3>
                    <p className="text-sm text-red-700">
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