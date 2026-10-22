'use client'

import { useEffect } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card'
import { isStaleClientBundleError, reloadForNewBuild } from './components/ChunkErrorGuard'
import { useSystemLocalization } from './context/use-system-localization'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const { t } = useSystemLocalization()
  const isStale = isStaleClientBundleError(error)

  // If the error is caused by stale chunks from a previous build, force a hard
  // reload so the browser fetches the latest HTML and chunk hashes. This is the
  // recovery path for users who had the tab open before a deploy.
  useEffect(() => {
    if (isStale) {
      reloadForNewBuild()
      return
    }

    console.error('Application error:', error)

    // Additional diagnostics for authentication problems.
    if (error.message.includes('token') || error.message.includes('auth')) {
      console.error('Possible authentication problem. Try signing out and signing in again.')
    }
  }, [error, isStale])

  if (isStale) {
    return null
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-red-600">{t('system.error.title')}</CardTitle>
          <CardDescription>
            {t('system.error.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-red-50 border border-red-100 rounded-md mb-4">
            <p className="text-sm font-medium text-red-800">{t('system.error.details')}</p>
            <p className="text-sm text-red-700 mt-1 break-words">
              {error.message || t('system.error.unknown')}
            </p>
            {error.digest && (
              <p className="text-xs text-red-500 mt-2">
                {t('system.error.id')} {error.digest}
              </p>
            )}
          </div>
          <p className="text-sm text-gray-500">
            {t('system.error.suggestions')}
          </p>
          <ul className="list-disc list-inside text-sm text-gray-500 mt-2 space-y-1">
            <li>{t('system.error.reload')}</li>
            <li>{t('system.error.clearCache')}</li>
            <li>{t('system.error.signOut')}</li>
            <li>{t('system.error.home')}</li>
          </ul>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/auth/login'}
          >
            {t('system.error.signIn')}
          </Button>
          <Button onClick={reset}>
            {t('system.error.retry')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
