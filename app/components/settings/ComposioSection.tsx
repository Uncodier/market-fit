"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import { CheckCircle2, Blocks } from "lucide-react"
import { type SiteFormValues } from "./form-schema"
import { secretsService } from "../../services/secrets-service"

import { ActionFooter } from "../ui/card-footer"

interface ComposioSectionProps {
  active: boolean
  siteId?: string
  onSave?: (data: SiteFormValues) => void
}

export function ComposioSection({ active, siteId, onSave }: ComposioSectionProps) {
  const [apiKey, setApiKey] = useState("")
  const [isApiKeyStored, setIsApiKeyStored] = useState(false)
  const [isSavingApiKey, setIsSavingApiKey] = useState(false)

  useEffect(() => {
    const checkApiKey = async () => {
      if (siteId) {
        const exists = await secretsService.checkSecretExists(siteId, 'composio', 'integrations')
        setIsApiKeyStored(exists)
      }
    }
    checkApiKey()
  }, [siteId])

  const handleSaveApiKey = async () => {
    if (!siteId || !apiKey) return
    setIsSavingApiKey(true)
    try {
      const success = await secretsService.storeSecret(
        siteId, 
        'composio', 
        'integrations', 
        'Composio API Key (BYOK)', 
        apiKey
      )
      if (success) {
        setIsApiKeyStored(true)
        setApiKey("") // Clear it from memory
        toast.success("Composio API Key saved securely")
      } else {
        toast.error("Failed to save Composio API Key")
      }
    } catch (error) {
      console.error(error)
      toast.error("Failed to save Composio API Key")
    } finally {
      setIsSavingApiKey(false)
    }
  }

  const handleDeleteApiKey = async () => {
    if (!siteId) return
    setIsSavingApiKey(true)
    try {
      const success = await secretsService.deleteSecret(siteId, 'composio', 'integrations')
      if (success) {
        setIsApiKeyStored(false)
        toast.success("Composio API Key removed")
      } else {
        toast.error("Failed to remove Composio API Key")
      }
    } catch (error) {
      console.error(error)
      toast.error("Failed to remove Composio API Key")
    } finally {
      setIsSavingApiKey(false)
    }
  }

  if (!active) return null

  return (
    <SectionCard id="composio-integration">
      <SectionCardHeader>
        <SectionCardTitle className="flex items-center gap-2">
          <Blocks className="h-5 w-5" />
          Composio Integration
        </SectionCardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          Bring your own Composio API key to enable powerful external actions for your agents.
        </p>
      </SectionCardHeader>
      <SectionCardContent className="pb-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">Composio API Key (BYOK)</Label>
          <p className="text-xs text-muted-foreground mb-4">
            Required to allow agents to interact with third-party tools via Composio.
          </p>
          {isApiKeyStored ? (
            <div className="flex items-center gap-2 mt-2 p-3 bg-muted/20 rounded-md border">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">API Key is securely stored in Vault</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="ml-auto text-destructive h-7 hover:bg-destructive/10"
                onClick={handleDeleteApiKey}
                disabled={isSavingApiKey}
              >
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="font-mono text-sm max-w-md"
              />
            </div>
          )}
        </div>
      </SectionCardContent>

      {!isApiKeyStored && (
        <ActionFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              Save your Composio API Key securely to Vault
            </div>
            <Button
              variant="outline"
              onClick={handleSaveApiKey}
              disabled={!apiKey || isSavingApiKey}
            >
              {isSavingApiKey ? "Saving..." : "Save Key"}
            </Button>
          </div>
        </ActionFooter>
      )}
    </SectionCard>
  )
}
