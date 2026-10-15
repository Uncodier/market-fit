"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import { useAuth } from "@/app/hooks/use-auth"
import { createApiKey } from "@/lib/api-keys"
import {
  createMakinariMcpSkill,
  mcpKeyValidityLabel,
  ONBOARDING_MCP_KEY_EXPIRATION_DAYS,
} from "@/lib/makinari-mcp-skill"
import { Button } from "@/app/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/app/components/ui/dialog"
import { Check, ClaudeLogo, CursorLogo, HermesLogo, Key, Loader2, OpenAILogo, OpenClawLogo } from "@/app/components/ui/icons"

const AGENTS = [
  { id: "cursor", name: "Cursor", icon: CursorLogo },
  { id: "claude", name: "Claude", icon: ClaudeLogo },
  { id: "codex", name: "OpenAI", icon: OpenAILogo },
  { id: "openclaw", name: "Open Claw", icon: OpenClawLogo },
  { id: "hermes", name: "Hermes", icon: HermesLogo },
] as const

type Agent = (typeof AGENTS)[number]

interface McpAgentSkillSetupProps {
  expirationDays: number
}

export function McpAgentSkillSetup({ expirationDays }: McpAgentSkillSetupProps) {
  const { user } = useAuth()
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)
  const generating = useRef(false)

  const generateAndDownloadSkill = async () => {
    if (generating.current || !selectedAgent) return
    if (!user) {
      toast.error("You must be logged in to create an API key")
      return
    }

    generating.current = true
    setIsGeneratingKey(true)
    try {
      // Preserve the user-level, create-project-only authorization used by onboarding.
      const result = await createApiKey({
        name: expirationDays === ONBOARDING_MCP_KEY_EXPIRATION_DAYS ? "Onboarding MCP Key" : "Agent Skills MCP Key",
        scopes: ["create_project"],
        site_id: null,
        user_id: user.id,
        expirationDays,
      })
      if (!result.apiKey) throw new Error("API key not generated")

      const markdown = createMakinariMcpSkill({ apiKey: result.apiKey, userId: user.id, expirationDays })
      const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }))
      const link = document.createElement("a")
      try {
        link.href = url
        link.download = `makinari-setup-${selectedAgent.id}.md`
        document.body.appendChild(link)
        link.click()
      } finally {
        link.remove()
        URL.revokeObjectURL(url)
      }

      toast.success("Skill downloaded successfully!")
      setSelectedAgent(null)
    } catch (error) {
      toast.error("Failed to generate API Key: " + (error instanceof Error ? error.message : "Unknown error"))
    } finally {
      generating.current = false
      setIsGeneratingKey(false)
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {AGENTS.map((agent) => (
          <Button key={agent.id} type="button" variant="outline" size="sm" onClick={() => setSelectedAgent(agent)}>
            <agent.icon className="h-4 w-4" />
            Use {agent.name}
          </Button>
        ))}
      </div>
      <Dialog open={selectedAgent !== null} onOpenChange={(open) => { if (!open && !generating.current) setSelectedAgent(null) }}>
        <DialogContent className="sm:max-w-[425px]" busy={isGeneratingKey}>
          <DialogHeader>
            <DialogTitle>Generate Agent Skill</DialogTitle>
            <DialogDescription>
              We will generate a secure API Key and download a <strong>.md</strong> file that contains the exact instructions and credentials your {selectedAgent?.name} agent needs.
              <br /><br />
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <Check className="h-3 w-3 text-green-500" />
                For extra security, this API Key will only be valid for {mcpKeyValidityLabel(expirationDays)} to create this site.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 pt-4">
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
              The downloaded file will contain a live API Key. Please be careful where you drop it or share it.
            </div>
            <Button type="button" className="w-full" onClick={generateAndDownloadSkill} disabled={isGeneratingKey}>
              {isGeneratingKey ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Key className="mr-2 h-4 w-4" />}
              {isGeneratingKey ? "Generating..." : "Generate Key & Download Skill"}
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}