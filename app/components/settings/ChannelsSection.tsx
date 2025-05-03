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
import { ColorInput } from "../ui/color-input"

export interface ChannelsSectionProps {
  active: boolean
  siteName?: string
  siteId?: string
  codeCopied?: boolean
  copyTrackingCode?: () => Promise<void>
}

export function ChannelsSection({ active, siteName, siteId, codeCopied, copyTrackingCode }: ChannelsSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [internalCodeCopied, setInternalCodeCopied] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  const handleCopyTrackingCode = async () => {
    if (copyTrackingCode) {
      return copyTrackingCode()
    }
    
    const trackingCode = `<script>
  // Market Fit Tracking Code
  (function() {
    window.MarketFit = window.MarketFit || {};
    MarketFit.siteId = "${siteId || siteName || 'YOUR_SITE_ID'}";
    MarketFit.trackVisitors = ${form.watch("tracking.track_visitors")};
    MarketFit.trackActions = ${form.watch("tracking.track_actions")};
    MarketFit.recordScreen = ${form.watch("tracking.record_screen")};
    MarketFit.enableChat = ${form.watch("tracking.enable_chat")};
    MarketFit.chatAccentColor = "${form.watch("tracking.chat_accent_color") || "#e0ff17"}";
    
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

  const handleConnectWhatsApp = async () => {
    try {
      setIsConnecting(true)
      // Here you would integrate with WhatsApp Business API
      setTimeout(() => {
        setIsConnecting(false)
      }, 1500)
    } catch (err) {
      console.error("Error connecting to WhatsApp Business API:", err)
      setIsConnecting(false)
    }
  }

  if (!active) return null

  return (
    <>
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Website Channel</CardTitle>
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
          <FormField
            control={form.control}
            name="tracking.enable_chat"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between">
                <div className="space-y-0.5">
                  <FormLabel>Enable Chat</FormLabel>
                  <FormDescription>
                    Show a chat widget on your site for visitor communication
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
          
          {form.watch("tracking.enable_chat") && (
            <FormField
              control={form.control}
              name="tracking.chat_accent_color"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Chat Accent Color</FormLabel>
                    <FormDescription>
                      Customize the color of the chat widget to match your brand
                    </FormDescription>
                  </div>
                  <FormControl>
                    <ColorInput
                      value={field.value}
                      onChange={field.onChange}
                      showHexValue={true}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          
          <div className="mt-8 pt-6 border-t border-border">
            <h3 className="text-base font-medium mb-3">Chat and Tracking Code</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add this code to your site to enable tracking and chat functionality
            </p>
            <div className="space-y-4">
              <div className="relative">
                <div className="rounded-md bg-gray-900 p-4 overflow-x-auto">
                  <pre className="text-sm text-white">
                    <code>{`<script>
  // Market Fit Tracking Code
  (function() {
    window.MarketFit = window.MarketFit || {};
    MarketFit.siteId = "${siteId || siteName || 'YOUR_SITE_ID'}";
    MarketFit.trackVisitors = ${form.watch("tracking.track_visitors")};
    MarketFit.trackActions = ${form.watch("tracking.track_actions")};
    MarketFit.recordScreen = ${form.watch("tracking.record_screen")};
    MarketFit.enableChat = ${form.watch("tracking.enable_chat")};
    MarketFit.chatAccentColor = "${form.watch("tracking.chat_accent_color") || "#e0ff17"}";
    
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
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">WhatsApp Business Channel</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Connect with WhatsApp Business API to enable messaging
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              WhatsApp integration allows you to communicate with your users directly through the WhatsApp platform.
              This feature is coming soon - you'll be able to connect your WhatsApp Business account and manage
              your communications from this dashboard.
            </p>
            <div className="flex justify-center gap-3 w-full">
              <Button 
                variant="outline" 
                type="button" 
                onClick={() => window.open("https://business.whatsapp.com/products/business-platform", "_blank")}
                className="flex-1 max-w-[50%]"
              >
                Learn More
              </Button>
              <Button 
                variant="secondary" 
                type="button"
                disabled={true}
                className="flex-1 max-w-[50%]"
              >
                Coming Soon
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
} 