"use client"

import { useDropzone } from "react-dropzone"
import Image from "next/image"
import { Input } from "../../ui/input"
import { Textarea } from "../../ui/textarea"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../ui/form"
import { normalizeSiteUrl, type SiteOnboardingValues } from "../schemas/onboarding-schema"
import type { UseFormReturn } from "react-hook-form"
import { McpAgentSkillSetup } from "@/app/components/skills/mcp-agent-skill-setup"
import { ONBOARDING_MCP_KEY_EXPIRATION_DAYS } from "@/lib/makinari-mcp-skill"
import { AppWindow, Globe, Tag, UploadCloud, Trash2, Bot } from "../../ui/icons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../ui/card"

interface BasicInfoStepProps {
  form: UseFormReturn<SiteOnboardingValues>
}

export function BasicInfoStep({ form }: BasicInfoStepProps) {
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
            Delegate the setup to your MCP-compatible agent. You will need an API key to authenticate.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <McpAgentSkillSetup expirationDays={ONBOARDING_MCP_KEY_EXPIRATION_DAYS} />
        </CardContent>
      </Card>
    </div>
  )
} 