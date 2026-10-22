'use client'

import { useEffect } from 'react'
import { isStaleClientBundleError, reloadForNewBuild } from './components/ChunkErrorGuard'
import { useSystemLocalization } from './context/use-system-localization'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const { t, locale } = useSystemLocalization()
  const isStale = isStaleClientBundleError(error)

  useEffect(() => {
    // Stale chunks from a previous deploy: hard reload to pull the new build.
    if (isStale) {
      reloadForNewBuild()
      return
    }

    // Optionally send the error to a logging service.
    console.error('Critical global error:', error)
  }, [error, isStale])

  if (isStale) {
    return (
      <html lang={locale}>
        <body></body>
      </html>
    )
  }

  return (
    <html lang={locale}>
      <body>
        <div className="flex flex-col justify-center items-center h-screen bg-red-50">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-center text-red-600">{t('system.error.criticalTitle')}</h2>
            <p className="mb-4 text-gray-600">
              {t('system.error.criticalDescription')}
            </p>
            <div className="p-4 mb-4 bg-gray-100 rounded-md">
              <p className="text-sm text-gray-700 font-mono">
                {error.message || t('system.error.unknown')}
              </p>
              {error.digest && (
                <p className="text-xs text-gray-500 mt-2 font-mono">{t('system.error.id')} {error.digest}</p>
              )}
            </div>
            <div className="mt-4 flex justify-center">
              <button 
                onClick={reset}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 w-full"
              >
                {t('system.error.retry')}
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
} 