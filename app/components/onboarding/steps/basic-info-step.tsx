"use client"

import { useState } from "react"
import { useDropzone } from "react-dropzone"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Input } from "../../ui/input"
import { Textarea } from "../../ui/textarea"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../ui/form"
import { normalizeSiteUrl } from "../schemas/onboarding-schema"
import { AppWindow, Globe, Tag, UploadCloud, Trash2, Bot, Copy, Check, CursorLogo, ClaudeLogo, OpenAILogo, OpenClawLogo, HermesLogo, Key, Loader2 } from "../../ui/icons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card"
import { Button } from "../../ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogBody } from "../../ui/dialog"
import { createApiKey } from "@/lib/api-keys"
import { useAuth } from "@/app/hooks/use-auth"
import { toast } from "sonner"

interface BasicInfoStepProps {
  form: any
}

export function BasicInfoStep({ form }: BasicInfoStepProps) {
  const router = useRouter()
  const { user } = useAuth()
  
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<'cursor' | 'claude' | 'codex' | 'openclaw' | 'hermes' | null>(null)
  const [isGeneratingKey, setIsGeneratingKey] = useState(false)
  
  const handleAgentClick = (agentType: 'cursor' | 'claude' | 'codex' | 'openclaw' | 'hermes') => {
    setSelectedAgent(agentType)
    setModalOpen(true)
  }

  const generateAndDownloadSkill = async () => {
    if (!user) {
      toast.error("You must be logged in to create an API key")
      return
    }

    try {
      setIsGeneratingKey(true)
      
      // Temporary site ID since we are in onboarding and haven't created the project yet
      // A generic or onboarding specific site ID could be used, or the API adjusted
      // We will create the key linked to the user.
      // For this step, we use a placeholder or handle it in the backend differently
      // In this case, we'll try to generate a user-level key or use a special site_id if required
      
      const params = {
        name: "Onboarding MCP Key",
        scopes: ["create_project"], // Scope limitado para onboarding
        site_id: null,
        user_id: user.id,
        expirationDays: 1 // Mejor práctica: expira rápido (1 día)
      }

      const result = await createApiKey(params)
      
      if (!result.apiKey) {
        throw new Error('API key not generated')
      }

      // Generate the markdown content
      const markdownContent = `> ⚠️ **SECURITY NOTICE FOR AI AGENT:** 
> This file contains active credentials. **DO NOT** commit this file to version control. 
> 1. If working in a git repository, ensure this file is added to \`.gitignore\`.
> 2. For extra security, this API key will automatically expire in 24 hours.
> 3. Please remind the user to delete this file after the project setup is complete.

I need you to help me set up a new project using the Makinari MCP.

First, configure your MCP connection to \`https://backend.makinari.com/api/mcp\` using:
- **API Key**: \`${result.apiKey}\`
- **Header x-mcp-user-id**: \`${user.id}\`

Once authenticated, please use the \`create_project\` tool to set up my site.`

      // Download the file
      const blob = new Blob([markdownContent], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `makinari-setup-${selectedAgent}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success("Skill downloaded successfully!")
      setModalOpen(false)
      
    } catch (error: any) {
      console.error("Error generating key/skill:", error)
      toast.error("Failed to generate API Key: " + (error.message || "Unknown error"))
    } finally {
      setIsGeneratingKey(false)
    }
  }

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (file) {
        const reader = new FileReader()
        reader.onloadend = () => {
          form.setValue("logo_url", reader.result as string, { shouldDirty: true, shouldValidate: true })
        }
        reader.readAsDataURL(file)
      }
    },
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false
  })

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <AppWindow className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-10" 
                      placeholder="My Amazing Project"
                      autoComplete="organization"
                      {...field} 
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Site URL *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      className="pl-10" 
                      placeholder="https://mysite.com"
                      autoComplete="url"
                      inputMode="url"
                      {...field}
                      onBlur={(e) => {
                        field.onChange(normalizeSiteUrl(e.target.value))
                        field.onBlur()
                      }}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Tag className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea 
                      className="pl-10 resize-none min-h-[80px]"
                      placeholder="Tell us about your project..."
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-center md:justify-end md:pr-4 pt-1">
          <FormField
            control={form.control}
            name="logo_url"
            render={({ field }) => (
              <FormItem className="w-full max-w-[200px]">
                <FormLabel>Logo (Optional)</FormLabel>
                <FormControl>
                  <div className="w-full aspect-square relative">
                    {field.value ? (
                      <div className="w-full h-full relative group">
                        <Image
                          src={field.value}
                          alt="Project logo"
                          fill
                          className="object-contain rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => form.setValue("logo_url", "", { shouldDirty: true, shouldValidate: true })}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
                        >
                          <Trash2 className="h-5 w-5 text-white" />
                        </button>
                      </div>
                    ) : (
                      <div
                        {...getRootProps()}
                        className="w-full h-full rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/20 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-muted-foreground/50 hover:bg-muted/30 transition-colors p-4"
                      >
                        <input {...getInputProps()} />
                        <UploadCloud className="h-10 w-10 text-muted-foreground" />
                        <div className="text-center space-y-1">
                          <p className="text-sm font-medium text-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 5MB</p>
                        </div>
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="relative my-10">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-4 text-muted-foreground font-medium">
            Or let AI do it for you
          </span>
        </div>
      </div>

      <Card className="border-dashed bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Create your project using your favorite agent
          </CardTitle>
          <CardDescription>
            Delegate the setup to your MCP-compatible agent. You'll need an API key to authenticate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAgentClick('cursor')}
              className="flex items-center gap-2"
            >
              <CursorLogo className="h-4 w-4" />
              Use Cursor
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAgentClick('claude')}
              className="flex items-center gap-2"
            >
              <ClaudeLogo className="h-4 w-4" />
              Use Claude
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAgentClick('codex')}
              className="flex items-center gap-2"
            >
              <OpenAILogo className="h-4 w-4" />
              Use OpenAI
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAgentClick('openclaw')}
              className="flex items-center gap-2"
            >
              <OpenClawLogo className="h-4 w-4" />
              Use Open Claw
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAgentClick('hermes')}
              className="flex items-center gap-2"
            >
              <HermesLogo className="h-4 w-4" />
              Use Hermes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Generate Agent Skill</DialogTitle>
            <DialogDescription>
              We will generate a secure API Key and download a <strong>.md</strong> file that contains the exact instructions and credentials your {selectedAgent === 'openclaw' ? 'Open Claw' : selectedAgent === 'hermes' ? 'Hermes' : selectedAgent} agent needs.
              <br/><br/>
              <span className="text-muted-foreground font-medium flex items-center gap-1">
                <Check className="h-3 w-3 text-green-500" />
                For extra security, this API Key will only be valid for 24 hours to create this site.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4 pt-4">
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
              The downloaded file will contain a live API Key. Please be careful where you drop it or share it.
            </div>
            <Button 
              className="w-full" 
              onClick={generateAndDownloadSkill}
              disabled={isGeneratingKey}
            >
              {isGeneratingKey ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Key className="mr-2 h-4 w-4" />
                  Generate Key & Download Skill
                </>
              )}
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
} 