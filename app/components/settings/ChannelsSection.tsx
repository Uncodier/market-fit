"use client"

import { useFormContext } from "react-hook-form"
import { useState } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Switch } from "../ui/switch"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "../ui/button"
import { Copy, Check, ChevronDown, ChevronUp, Globe } from "../ui/icons"
import { Textarea } from "../ui/textarea"
import { ColorInput } from "../ui/color-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import { toast } from "sonner"
import { SupportChannelsSection } from "./SupportChannelsSection"

export interface ChannelsSectionProps {
  active: boolean
  siteId?: string
  siteName?: string
  onSave?: (data: SiteFormValues) => void
  copyTrackingCode?: () => void
  codeCopied?: boolean
  excludeWebsite?: boolean
}

export function ChannelsSection({ 
  active, 
  siteId, 
  siteName, 
  onSave, 
  copyTrackingCode, 
  codeCopied,
  excludeWebsite = false
}: ChannelsSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const enableChat = form.watch("tracking.enable_chat")
  const [showTrackingCode, setShowTrackingCode] = useState(false)
  const [savingCard, setSavingCard] = useState<string | null>(null)

  const handleSave = async (cardId: string) => {
    if (!onSave) return
    setSavingCard(cardId)
    try {
      await onSave(form.getValues())
    } finally {
      setSavingCard(null)
    }
  }

  const handleCopyTrackingCode = async () => {
    if (copyTrackingCode) {
      return copyTrackingCode()
    }
    
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
          trackVisitors: ${form.getValues("tracking.track_visitors")},
          trackActions: ${form.getValues("tracking.track_actions")},
          recordScreen: ${form.getValues("tracking.record_screen")},
          debug: false,
          chat: {
            enabled: ${form.getValues("tracking.enable_chat")},
            accentColor: "${form.getValues("tracking.chat_accent_color") || "#e0ff17"}",
            allowAnonymousMessages: ${form.getValues("tracking.allow_anonymous_messages") || false},
            position: "${form.getValues("tracking.chat_position") || "bottom-right"}",
            title: "${form.getValues("tracking.chat_title") || "Chat with us"}",
            welcomeMessage: "${form.getValues("tracking.welcome_message") || "Welcome to our website! How can we assist you today?"}"
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
        await navigator.clipboard.writeText(trackingCode)
        toast.success("Tracking code copied to clipboard")
        return
      }
      
      // Fallback to older document.execCommand method
      const textArea = document.createElement('textarea')
      textArea.value = trackingCode
      
      // Make the textarea out of viewport
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      textArea.style.top = '-999999px'
      document.body.appendChild(textArea)
      
      // Select and copy
      textArea.focus()
      textArea.select()
      
      const success = document.execCommand('copy')
      document.body.removeChild(textArea)
      
      if (success) {
        toast.success("Tracking code copied to clipboard")
      } else {
        throw new Error("Copy command failed")
      }
    } catch (err) {
      console.error("Error copying tracking code:", err)
      toast.error("Failed to copy tracking code. Please try selecting and copying manually.")
    }
  }

  if (!active) return null

  return (
    <>
      <SupportChannelsSection active={active} siteId={siteId} onSave={onSave} />

      {!excludeWebsite && (
      <SectionCard id="website-channel">
        <SectionCardHeader>
          <SectionCardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Website Channel
          </SectionCardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how your site tracks visitor behavior
          </p>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
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
          
          {enableChat && (
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
          
          {enableChat && (
            <FormField
              control={form.control}
              name="tracking.chat_position"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Chat Position</FormLabel>
                    <FormDescription>
                      Choose where the chat widget appears on your site
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Select
                      value={field.value || "bottom-right"}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-right">Bottom Right</SelectItem>
                        <SelectItem value="bottom-left">Bottom Left</SelectItem>
                        <SelectItem value="top-right">Top Right</SelectItem>
                        <SelectItem value="top-left">Top Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          
          {enableChat && (
            <FormField
              control={form.control}
              name="tracking.chat_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chat Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Chat with us"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Title displayed on the chat widget
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {enableChat && (
            <FormField
              control={form.control}
              name="tracking.welcome_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Welcome Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Welcome to our website! How can we assist you today?"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Initial message visitors see when the chat widget opens. Default: "Welcome to our website! How can we assist you today?"
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {enableChat && (
            <FormField
              control={form.control}
              name="tracking.allow_anonymous_messages"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel>Allow Anonymous Messages</FormLabel>
                    <FormDescription>
                      Allow visitors to send messages without providing contact information
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
          )}
          
          <div className="mt-8 pt-6 border-t dark:border-white/5 border-black/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-medium">Chat and Tracking Code</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowTrackingCode(!showTrackingCode)}
                className="h-8 px-2 text-sm"
              >
                {showTrackingCode ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-1" />
                    Hide Code
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Show Code
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Add this code to your site to enable tracking and chat functionality
            </p>
            
            {showTrackingCode && (
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
          trackVisitors: ${form.getValues("tracking.track_visitors")},
          trackActions: ${form.getValues("tracking.track_actions")},
          recordScreen: ${form.getValues("tracking.record_screen")},
          debug: false,
          chat: {
            enabled: ${form.getValues("tracking.enable_chat")},
            accentColor: "${form.getValues("tracking.chat_accent_color") || "#e0ff17"}",
            allowAnonymousMessages: ${form.getValues("tracking.allow_anonymous_messages") || false},
            position: "${form.getValues("tracking.chat_position") || "bottom-right"}",
            title: "${form.getValues("tracking.chat_title") || "Chat with us"}",
            welcomeMessage: "${form.getValues("tracking.welcome_message") || "Welcome to our website! How can we assist you today?"}"
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
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="absolute top-4 right-4"
                      onClick={handleCopyTrackingCode}
                    >
                      {codeCopied ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCardContent>
        <SectionCardFooter className="flex justify-between items-center bg-gray-50/50 dark:bg-gray-900/50">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${form.getValues("tracking.enabled") ? "bg-green-500" : "bg-gray-300 dark:bg-gray-700"}`} />
            <span className="text-sm text-muted-foreground">
              {form.getValues("tracking.enabled") ? "Tracking Active" : "Tracking Disabled"}
            </span>
          </div>
          <Button variant="outline" size="sm"
            type="button"
            onClick={() => handleSave('website-channel')}
            disabled={savingCard === 'website-channel' || !form.formState.isDirty}
          >
            {savingCard === 'website-channel' ? "Saving..." : "Save"}
          </Button>
        </SectionCardFooter>
      </SectionCard>
      )}
    </>
  )
}