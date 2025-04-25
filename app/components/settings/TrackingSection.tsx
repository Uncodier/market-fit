"use client"

import { useFormContext } from "react-hook-form"
import { useState } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Switch } from "../ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { Code, Copy, Check } from "../ui/icons"
import { Textarea } from "../ui/textarea"

export interface TrackingSectionProps {
  active: boolean
  siteName?: string
  codeCopied?: boolean
  copyTrackingCode?: () => Promise<void>
}

export function TrackingSection({ active, siteName, codeCopied, copyTrackingCode }: TrackingSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [internalCodeCopied, setInternalCodeCopied] = useState(false)

  const handleCopyTrackingCode = async () => {
    if (copyTrackingCode) {
      return copyTrackingCode()
    }
    
    const trackingCode = `<script>
  // Market Fit Tracking Code
  (function() {
    window.MarketFit = window.MarketFit || {};
    MarketFit.siteId = "${siteName || 'YOUR_SITE_NAME'}";
    MarketFit.trackVisitors = ${form.watch("tracking.track_visitors")};
    MarketFit.trackActions = ${form.watch("tracking.track_actions")};
    MarketFit.recordScreen = ${form.watch("tracking.record_screen")};
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://api.market-fit.ai/tracking.js';
    var firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  })();
</script>`

    try {
      await navigator.clipboard.writeText(trackingCode)
      setInternalCodeCopied(true)
      setTimeout(() => setInternalCodeCopied(false), 2000)
    } catch (err) {
      console.error("Error copying tracking code:", err)
    }
  }

  if (!active) return null

  return (
    <>
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Tracking Settings</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how your site tracks visitor behavior
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <FormField
            control={form.control}
            name="tracking.track_visitors"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Track Visitors</FormLabel>
                  <FormDescription>
                    Collect anonymous data about visitors to your site
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tracking.track_actions"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Track User Actions</FormLabel>
                  <FormDescription>
                    Record clicks, form submissions, and other interactions
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tracking.record_screen"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Session Recording</FormLabel>
                  <FormDescription>
                    Record user sessions to replay their experience
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Tracking Code</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Add this code to your site to enable tracking
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="space-y-4">
            <div className="relative">
              <div className="rounded-md bg-gray-900 p-4 overflow-x-auto">
                <pre className="text-sm text-white">
                  <code>{`<script>
  // Market Fit Tracking Code
  (function() {
    window.MarketFit = window.MarketFit || {};
    MarketFit.siteId = "${siteName || 'YOUR_SITE_NAME'}";
    MarketFit.trackVisitors = ${form.watch("tracking.track_visitors")};
    MarketFit.trackActions = ${form.watch("tracking.track_actions")};
    MarketFit.recordScreen = ${form.watch("tracking.record_screen")};
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://api.market-fit.ai/tracking.js';
    var firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode.insertBefore(script, firstScript);
  })();
</script>`}</code>
                </pre>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 h-8 w-8 p-0"
                onClick={handleCopyTrackingCode}
              >
                {(codeCopied || internalCodeCopied) ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Place this code in the <code>&lt;head&gt;</code> section of every page you want to track.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Analytics Integration</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Connect with external analytics services
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <FormField
            control={form.control}
            name="analytics_provider"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Analytics Provider</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Google Analytics, Fathom, Plausible, etc."
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="analytics_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tracking ID</FormLabel>
                <FormControl>
                  <Input
                    placeholder="GA-12345678"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tracking_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom Tracking Code</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Paste your custom tracking code here"
                    className="min-h-[100px] font-mono text-sm"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  Paste any custom tracking or analytics code here. It will be added to your site alongside the Market Fit tracking code.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </>
  )
} 