"use client"

import { useState, useEffect } from "react"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { QuickNav, type QuickNavSection } from "@/app/components/ui/quick-nav"
import { 
  Shield, 
  Check,
  Key,
  Globe,
  Bot,
} from "@/app/components/ui/icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs"
import { ApiKeysList } from "@/app/components/api-keys/api-keys-list"
import { RobotSessionsList } from "@/app/components/security/robot-sessions-list"
import { AllowedDomainsList } from "@/app/components/security/allowed-domains-list"
import { AuthenticationSettings } from "@/app/components/security/authentication-settings"

// Section configurations for quick navigation
const authenticationSections: QuickNavSection[] = [
  { id: "change-password", title: "Change Password" },
  { id: "two-factor-authentication", title: "Two-Factor Authentication" },
]

const getInitialApiKeysSections = (): QuickNavSection[] => [
  { 
    id: "api-keys", 
    title: "API Keys",
    children: []
  },
]

const robotSessionsSections: QuickNavSection[] = [
  { id: "robot-sessions", title: "Robot Sessions" },
]

const getInitialAllowedDomainsSections = (): QuickNavSection[] => [
  { 
    id: "allowed-domains", 
    title: "Allowed Domains",
    children: []
  },
]

export default function SecurityPage() {
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const [activeTab, setActiveTab] = useState("authentication");
  const [apiKeysSections, setApiKeysSections] = useState<QuickNavSection[]>(getInitialApiKeysSections())
  const [allowedDomainsSections, setAllowedDomainsSections] = useState<QuickNavSection[]>(getInitialAllowedDomainsSections())

  // Listen for API keys updates
  useEffect(() => {
    const handleApiKeysUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setApiKeysSections([
        {
          id: "api-keys",
          title: "API Keys",
          children: items
        }
      ]);
    };

    window.addEventListener('apiKeysUpdated', handleApiKeysUpdate as EventListener);
    return () => {
      window.removeEventListener('apiKeysUpdated', handleApiKeysUpdate as EventListener);
    };
  }, []);

  // Listen for allowed domains updates
  useEffect(() => {
    const handleAllowedDomainsUpdate = (event: CustomEvent) => {
      const items = event.detail as { id: string; title: string }[];
      setAllowedDomainsSections([
        {
          id: "allowed-domains",
          title: "Allowed Domains",
          children: items
        }
      ]);
    };

    window.addEventListener('allowedDomainsUpdated', handleAllowedDomainsUpdate as EventListener);
    return () => {
      window.removeEventListener('allowedDomainsUpdated', handleAllowedDomainsUpdate as EventListener);
    };
  }, []);

  // Get current sections based on active tab
  const getCurrentSections = (): QuickNavSection[] => {
    switch (activeTab) {
      case "authentication":
        return authenticationSections
      case "api_keys":
        return apiKeysSections
      case "robot_sessions":
        return robotSessionsSections
      case "allowed_domains":
        return allowedDomainsSections
      default:
        return []
    }
  }

  return (
    <div className="flex-1">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <StickyHeader>
          <div className="flex items-center justify-between px-16 w-full">
            <TabsList className="w-auto">
              <TabsTrigger value="authentication" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Authentication
              </TabsTrigger>
              <TabsTrigger value="api_keys" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                API Keys
              </TabsTrigger>
              <TabsTrigger value="robot_sessions" className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Robot Sessions
              </TabsTrigger>
              <TabsTrigger value="allowed_domains" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Allowed Domains
              </TabsTrigger>
            </TabsList>
            <div className="flex-1">
              {passwordUpdated && (
                <div className="flex items-center text-green-500">
                  <Check className="h-4 w-4 mr-2" />
                  <span>Password successfully updated</span>
                </div>
              )}
            </div>
          </div>
        </StickyHeader>
        
        <div className="py-8 pb-16">
          <div className="flex gap-8 justify-center max-w-[1200px] mx-auto">
            <div className="flex-1 max-w-[880px] px-16">
              <TabsContent value="authentication">
                <AuthenticationSettings onPasswordUpdated={setPasswordUpdated} />
              </TabsContent>

              <TabsContent value="api_keys">
                <ApiKeysList />
              </TabsContent>

              <TabsContent value="robot_sessions">
                <Card id="robot-sessions" className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
                  <CardHeader className="px-8 py-6">
                    <CardTitle className="text-xl font-semibold">Robot Sessions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-8 px-8 pb-8 w-full">
                    <div className="text-sm text-muted-foreground">
                      Manage automation authentication sessions for makinas. These sessions store browser authentication data that can be reused across automation instances.
                    </div>
                    <RobotSessionsList />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="allowed_domains">
                <AllowedDomainsList />
              </TabsContent>
            </div>
            <QuickNav sections={getCurrentSections()} />
          </div>
        </div>
      </Tabs>
    </div>
  )
}
