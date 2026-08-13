"use client"

import { useFormContext } from "react-hook-form"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "../ui/button"
import { FormField, FormItem, FormControl, FormMessage } from "../ui/form"
import { Input } from "../ui/input"
import { type SiteFormValues } from "./form-schema"
import { useState, useEffect } from "react"
import { PlusCircle, Trash2 } from "../ui/icons"

interface WebResourcesSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

export function WebResourcesSection({ active, onSave }: WebResourcesSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [savingCard, setSavingCard] = useState<string | null>(null)
  const [resourceList, setResourceList] = useState<{key: string, url: string}[]>(
    form.getValues("resource_urls") || []
  )

  // Update local state when form values change
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'resource_urls' && value.resource_urls && Array.isArray(value.resource_urls)) {
        setResourceList(value.resource_urls);
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleSave = async (id: string) => {
    if (!onSave) return
    setSavingCard(id)
    try {
      const formData = form.getValues()
      await onSave(formData)
      form.reset(formData)
    } catch (error) {
      console.error("Error saving web resources:", error)
    } finally {
      setSavingCard(null)
    }
  }

  // Add resource entry
  const addResource = () => {
    const newResources = [{ key: "", url: "" }, ...resourceList]
    setResourceList(newResources)
    form.setValue("resource_urls", newResources)
  }

  // Remove resource entry
  const removeResource = (index: number) => {
    const newResources = resourceList.filter((_, i) => i !== index)
    setResourceList(newResources)
    form.setValue("resource_urls", newResources)
  }

  if (!active) return null

  return (
    <SectionCard id="web-resources">
      <SectionCardHeader>
        <div className="flex items-center justify-between">
          <div>
            <SectionCardTitle>Web Resources</SectionCardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Add important web resources, documentation, or links related to your site
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={addResource}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Resource
          </Button>
        </div>
      </SectionCardHeader>
      <SectionCardContent className="space-y-4">
        {resourceList.map((resource, index) => (
          <div key={index} className="flex items-center space-x-2">
            <FormField
              control={form.control}
              name={`resource_urls.${index}.key`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      className="h-12 text-base"
                      placeholder="Resource name"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        const newResources = [...resourceList]
                        newResources[index].key = e.target.value
                        setResourceList(newResources)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`resource_urls.${index}.url`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      className="h-12 text-base"
                      placeholder="https://example.com/resource"
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        const newResources = [...resourceList]
                        newResources[index].url = e.target.value
                        setResourceList(newResources)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              size="icon"
              variant="ghost"
              type="button"
              onClick={() => removeResource(index)}
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        ))}
      </SectionCardContent>
      <SectionCardFooter>
        <Button variant="outline" size="sm"
          onClick={() => handleSave('web-resources')}
          disabled={savingCard === 'web-resources' || !form.formState.isDirty}
        >
          {savingCard === 'web-resources' ? "Saving..." : "Save"}
        </Button>
      </SectionCardFooter>
    </SectionCard>
  )
}
