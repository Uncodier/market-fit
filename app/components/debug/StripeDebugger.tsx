"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { CheckCircle2, XCircle, AlertCircle, Info } from "../ui/icons"
import { safeReload } from "../../utils/safe-reload"

export function StripeDebugger() {
  const [debugInfo, setDebugInfo] = useState<{
    hasStripeKey: boolean
    stripeKeyFormat: string
    stripeKeyValid: boolean
    isClientSide: boolean
    stripeInitialized: boolean
    stripeError: string | null
    networkConnected: boolean
  }>({
    hasStripeKey: false,
    stripeKeyFormat: "",
    stripeKeyValid: false,
    isClientSide: false,
    stripeInitialized: false,
    stripeError: null,
    networkConnected: false
  })

  useEffect(() => {
    const checkStripeConfiguration = async () => {
      const isClientSide = typeof window !== 'undefined'
      const stripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
      const hasStripeKey = !!stripeKey
      const stripeKeyValid = stripeKey ? stripeKey.startsWith('pk_') : false
      const stripeKeyFormat = stripeKey ? 
        `${stripeKey.substring(0, 12)}...${stripeKey.substring(stripeKey.length - 4)}` : 
        "Not found"

      // Check network connectivity
      let networkConnected = false
      try {
        await fetch('https://js.stripe.com/v3/', { method: 'HEAD', mode: 'no-cors' })
        networkConnected = true
      } catch (error) {
        networkConnected = false
      }

      // Try to load Stripe
      let stripeInitialized = false
      let stripeError = null
      
      if (isClientSide && hasStripeKey && stripeKeyValid) {
        try {
          const { loadStripe } = await import('@stripe/stripe-js')
          const stripe = await loadStripe(stripeKey)
          stripeInitialized = !!stripe
          
          if (!stripe) {
            stripeError = "Stripe SDK failed to initialize (returned null)"
          }
        } catch (error) {
          stripeError = error instanceof Error ? error.message : "Unknown error loading Stripe"
        }
      }

      setDebugInfo({
        hasStripeKey,
        stripeKeyFormat,
        stripeKeyValid,
        isClientSide,
        stripeInitialized,
        stripeError,
        networkConnected
      })
    }

    checkStripeConfiguration()
  }, [])

  const getStatusIcon = (success: boolean, warning?: boolean) => {
    if (success) return <CheckCircle2 className="h-5 w-5 text-green-600" />
    if (warning) return <AlertCircle className="h-5 w-5 text-yellow-600" />
    return <XCircle className="h-5 w-5 text-red-600" />
  }

  const retest = () => {
    safeReload(false, "Stripe configuration retest")
  }

  return (
    <Card className="border border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Info className="h-5 w-5" />
          Stripe Configuration Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(debugInfo.isClientSide)}
              <div>
                <p className="font-medium">Client Side Rendering</p>
                <p className="text-sm text-muted-foreground">
                  {debugInfo.isClientSide ? "Running in browser" : "Running on server"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(debugInfo.hasStripeKey)}
              <div>
                <p className="font-medium">Stripe Publishable Key</p>
                <p className="text-sm text-muted-foreground">
                  {debugInfo.hasStripeKey ? `Found: ${debugInfo.stripeKeyFormat}` : "Not found in environment"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(debugInfo.stripeKeyValid)}
              <div>
                <p className="font-medium">Key Format Validation</p>
                <p className="text-sm text-muted-foreground">
                  {debugInfo.stripeKeyValid ? "Starts with 'pk_' (Valid)" : "Invalid format - should start with 'pk_'"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(debugInfo.networkConnected)}
              <div>
                <p className="font-medium">Network Connectivity</p>
                <p className="text-sm text-muted-foreground">
                  {debugInfo.networkConnected ? "Can reach Stripe servers" : "Cannot reach Stripe servers"}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              {getStatusIcon(debugInfo.stripeInitialized)}
              <div>
                <p className="font-medium">Stripe SDK Initialization</p>
                <p className="text-sm text-muted-foreground">
                  {debugInfo.stripeInitialized ? "Successfully initialized" : 
                   debugInfo.stripeError ? `Failed: ${debugInfo.stripeError}` : "Not attempted"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {debugInfo.stripeError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg">
            <div className="flex items-start gap-2">
              <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="font-medium text-red-900 dark:text-red-100">Stripe Initialization Error</p>
                <p className="text-sm text-red-700 dark:text-red-200 mt-1">{debugInfo.stripeError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={retest} variant="outline">
            Re-test Configuration
          </Button>
        </div>

        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Environment Variables:</strong> Ensure your .env.local file contains NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</p>
          <p><strong>Development:</strong> Use pk_test_... keys for testing</p>
          <p><strong>Production:</strong> Use pk_live_... keys for production</p>
        </div>
      </CardContent>
    </Card>
  )
} 