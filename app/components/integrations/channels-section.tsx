"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card"
import { Button } from "@/app/components/ui/button"

export function ChannelsSection() {
  return (
    <>
      <Card className="border border-border">
        <CardHeader>
          <CardTitle>Web</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Enable website messaging and configure your site channel. Set up the widget and routing preferences in Channels.
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Configure website channel and availability</li>
            <li>Customize widget behavior and branding</li>
            <li>Manage routing, notifications and auto-replies</li>
          </ul>
          <div className="pt-2">
            <Button
              type="button"
              onClick={() => {
                const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
                window.location.href = `${base}/settings?tab=channels`
              }}
            >
              Go to Channels
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle>Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Configure SMTP (or provider) credentials to send emails. Credentials are stored securely using our secure tokens service.
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Enter email, password/app token, SMTP host and port</li>
            <li>Test connection and store token securely</li>
            <li>Set default sender and reply-to</li>
          </ul>
          <div className="pt-2">
            <Button
              type="button"
              onClick={() => {
                const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
                window.location.href = `${base}/settings?tab=channels`
              }}
            >
              Go to Channels
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardHeader>
          <CardTitle>WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Connect your WhatsApp to send and receive messages. You can use your own Twilio account or request Uncodie-managed setup.
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Provide Account SID and Phone Number (own account)</li>
            <li>Store API token securely via Channels</li>
            <li>Verify number connectivity and status</li>
          </ul>
          <div className="pt-2">
            <Button
              type="button"
              onClick={() => {
                const base = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
                window.location.href = `${base}/settings?tab=channels`
              }}
            >
              Go to Channels
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

























