"use client"

import { Card, CardContent } from "../../ui/card"
import { Check, Globe, AppWindow } from "../../ui/icons"

interface SuccessStepProps {
  projectName: string
  onNavigateToSettings: () => void
  onNavigateToDashboard?: () => Promise<void>
}

export function SuccessStep({ projectName, onNavigateToSettings, onNavigateToDashboard }: SuccessStepProps) {
  const handleDashboardClick = () => {
    if (onNavigateToDashboard) {
      onNavigateToDashboard()
    } else {
      // Fallback - this shouldn't happen in normal flow
      window.location.href = "/dashboard"
    }
  }

  const handleSettingsClick = () => {
    if (onNavigateToSettings) {
      onNavigateToSettings()
    }
  }

  return (
    <div className="space-y-8">
      {/* Success Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
            <Check className="h-8 w-8 text-white" />
          </div>
        </div>
        <div className="space-y-3">
          <h2 className="text-2xl font-bold text-foreground">
            🎉 Welcome to Market Fit Intelligence!
          </h2>
          <p className="text-lg text-muted-foreground">
            <strong>{projectName}</strong> You can now collaborate with your AI team!
          </p>
          <div className="bg-muted/30 rounded-lg p-4 mx-auto max-w-md">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your AI agents will begin analyzing and monitoring <strong>tomorrow during business hours</strong>. 
              They'll continuously track market signals, user feedback, and growth opportunities to help you make data-driven decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Next Steps Section */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card 
          className="border-2 hover:border-primary/50 transition-colors cursor-pointer"
          onClick={handleDashboardClick}
        >
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <AppWindow className="h-5 w-5 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground">Go to Dashboard</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Start exploring your project analytics, view real-time insights, and monitor your AI agents' progress. 
                Your journey to better market fit begins here.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="border-2 hover:border-primary/50 transition-colors cursor-pointer"
          onClick={handleSettingsClick}
        >
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <h4 className="font-semibold text-foreground">Connect Your Channels</h4>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Link WhatsApp, Email, and your website to capture real customer conversations and feedback. 
                This helps our AI understand your market fit more accurately.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 