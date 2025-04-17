'use client'

import { useEffect } from 'react'
import { Button } from '@/app/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card'
import * as Icons from '@/app/components/ui/icons'
import Link from 'next/link'

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log the error to the console
  useEffect(() => {
    console.error('Chat Error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Icons.AlertCircle className="h-5 w-5 text-red-500" />
            <CardTitle>Chat Error</CardTitle>
          </div>
          <CardDescription>
            An error occurred while loading the chat interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-red-50 border border-red-100 rounded-md mb-4 dark:bg-red-900/20 dark:border-red-800">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Error details:</p>
            <p className="text-sm text-red-700 mt-1 break-words dark:text-red-300">
              {error.message || "Unknown error"}
            </p>
            {error.digest && (
              <p className="text-xs text-red-500 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            You can try:
          </p>
          <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
            <li>Refreshing the page</li>
            <li>Checking your network connection</li>
            <li>Signing out and signing back in</li>
          </ul>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Link href="/agents">
            <Button variant="outline">
              Back to Agents
            </Button>
          </Link>
          <Button onClick={reset}>
            Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 