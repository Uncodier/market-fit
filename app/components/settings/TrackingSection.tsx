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
import { toast } from "sonner"

export interface TrackingSectionProps {
  active: boolean
  siteName?: string
  siteId?: string
  codeCopied?: boolean
  copyTrackingCode?: () => Promise<void>
}

export function TrackingSection({ active, siteName, siteId, codeCopied, copyTrackingCode }: TrackingSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [internalCodeCopied, setInternalCodeCopied] = useState(false)

  const handleCopyTrackingCode = async () => {
    if (copyTrackingCode) {
      return copyTrackingCode()
    }
    
    console.log("Copying tracking code with siteId:", siteId, "siteName:", siteName);
    
    const trackingCode = `<script>
  (function() {
    window.MarketFit = window.MarketFit || {};
    
    MarketFit.siteId = "${siteId || siteName || 'YOUR_SITE_ID'}";
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://files.uncodie.com/tracking.min.js';
    
    script.onload = function() {
      if (window.MarketFit && typeof window.MarketFit.init === 'function') {
        window.MarketFit.init({
          siteId: "${siteId || siteName || 'YOUR_SITE_ID'}",
          trackVisitors: ${form.watch("tracking.track_visitors")},
          trackActions: ${form.watch("tracking.track_actions")},
          recordScreen: ${form.watch("tracking.record_screen")},
          debug: false,
          chat: {
            enabled: false
          }
        });
      }
    };
    
    var firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      // Fallback: append to head or body if no script tags exist
      var target = document.head || document.body;
      if (target) {
        target.appendChild(script);
      }
    }
  })();
</script>`

    try {
      // Try to use the modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(trackingCode);
        setInternalCodeCopied(true);
        toast.success("Tracking code copied to clipboard");
        setTimeout(() => setInternalCodeCopied(false), 2000);
        return;
      }
      
      // Fallback to older document.execCommand method
      const textArea = document.createElement('textarea');
      textArea.value = trackingCode;
      
      // Make the textarea out of viewport
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      
      // Select and copy
      textArea.focus();
      textArea.select();
      
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (success) {
        setInternalCodeCopied(true);
        toast.success("Tracking code copied to clipboard");
        setTimeout(() => setInternalCodeCopied(false), 2000);
      } else {
        throw new Error("Copy command failed");
      }
    } catch (err) {
      console.error("Error copying tracking code:", err);
      toast.error("Failed to copy tracking code. Please try selecting and copying manually.");
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
  (function() {
    window.MarketFit = window.MarketFit || {};
    
    MarketFit.siteId = "${siteId || siteName || 'YOUR_SITE_ID'}";
    
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://files.uncodie.com/tracking.min.js';
    
    script.onload = function() {
      if (window.MarketFit && typeof window.MarketFit.init === 'function') {
        window.MarketFit.init({
          siteId: "${siteId || siteName || 'YOUR_SITE_ID'}",
          trackVisitors: ${form.watch("tracking.track_visitors")},
          trackActions: ${form.watch("tracking.track_actions")},
          recordScreen: ${form.watch("tracking.record_screen")},
          debug: false,
          chat: {
            enabled: false
          }
        });
      }
    };
    
    var firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      // Fallback: append to head or body if no script tags exist
      var target = document.head || document.body;
      if (target) {
        target.appendChild(script);
      }
    }
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
    </>
  )
} 