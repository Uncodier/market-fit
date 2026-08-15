"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "../ui/button"
import { Trash2, UploadCloud, AppWindow, Globe, Tag } from "../ui/icons"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { useDropzone } from "react-dropzone"
import Image from "next/image"
import { useState } from "react"
import { useLocalization, type SupportedLocale } from "@/app/context/LocalizationContext"

const SITE_LOCALES: { value: SupportedLocale; label: string }[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
]

interface GeneralSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

export function GeneralSection({ active, onSave }: GeneralSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const { t } = useLocalization()
  const [savingCard, setSavingCard] = useState<string | null>(null)

  const handleSave = async (id: string) => {
    if (!onSave) return
    setSavingCard(id)
    try {
      const formData = form.getValues()
      await onSave(formData)
      form.reset(formData)
    } catch (error) {
      console.error("Error saving general settings:", error)
    } finally {
      setSavingCard(null)
    }
  }

  // Handle logo upload
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

  if (!active) return null

  return (
    <SectionCard id="site-information">
      <SectionCardHeader>
        <SectionCardTitle>Site Information</SectionCardTitle>
      </SectionCardHeader>
      <SectionCardContent className="space-y-4">
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
          <div className="min-w-[240px] flex-shrink-0">
            <FormField
              control={form.control}
              name="logo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Logo</FormLabel>
                  <FormControl>
                    <div className="w-[240px] h-[240px] relative">
                      {field.value ? (
                        <div className="w-full h-full relative group">
                          <Image
                            src={field.value}
                            alt="Site logo"
                            fill
                            className="object-contain rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => form.setValue("logo_url", "", { shouldDirty: true, shouldValidate: true })}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
                          >
                            <Trash2 className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div
                          {...getRootProps()}
                          className="w-full h-full rounded-lg border-2 border-dashed border-input bg-muted flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-input/80 hover:bg-muted/80 transition-colors"
                        >
                          <input {...getInputProps()} />
                          <div className="flex flex-col items-center justify-center">
                            <UploadCloud className="h-8 w-8 text-muted-foreground flex-shrink-0 mb-2" />
                            <div className="text-sm text-center flex flex-col items-center">
                              <p className="font-medium text-foreground">Click to upload</p>
                              <p className="text-muted-foreground">or drag and drop</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />
          </div>
          <div className="flex-1 space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Site Name</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <AppWindow className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        className="pl-12 h-12 text-base" 
                        placeholder="Enter your site name"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Site URL</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        className="pl-12 h-12 text-base" 
                        placeholder="https://example.com"
                        {...field} 
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="default_locale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">
                    {t("settings.general.defaultLocale") || "Default site language"}
                  </FormLabel>
                  <Select
                    value={field.value || "en"}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue
                          placeholder={
                            t("settings.general.defaultLocalePlaceholder") ||
                            "Select language"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SITE_LOCALES.map((locale) => (
                        <SelectItem key={locale.value} value={locale.value}>
                          {locale.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t("settings.general.defaultLocaleDescription") ||
                      "Language used for quotes, emails, and other outbound documents."}
                  </FormDescription>
                  <FormMessage className="text-xs mt-2" />
                </FormItem>
              )}
            />
          </div>
        </div>
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-sm font-medium text-foreground">Description</FormLabel>
              <FormControl>
                <div className="relative">
                  <Tag className="absolute left-4 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea 
                    className="pl-12 resize-none min-h-[72px] text-base"
                    placeholder="Describe your site..."
                    {...field}
                    value={field.value || ""}
                  />
                </div>
              </FormControl>
              <FormMessage className="text-xs mt-2" />
            </FormItem>
          )}
        />
      </SectionCardContent>
      <SectionCardFooter>
        <Button variant="outline" size="sm"
          onClick={() => handleSave('site-information')}
          disabled={savingCard === 'site-information' || !form.formState.isDirty}
        >
          {savingCard === 'site-information' ? "Saving..." : "Save"}
        </Button>
      </SectionCardFooter>
    </SectionCard>
  )
} 