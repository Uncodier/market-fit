"use client"

import { useFormContext } from "react-hook-form"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Slider } from "../ui/slider"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, UploadCloud } from "../ui/icons"
import { useDropzone } from "react-dropzone"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useState } from "react"

interface GeneralSectionProps {
  active: boolean
  focusModeConfig: (value: number) => any
}

export function GeneralSection({ active, focusModeConfig }: GeneralSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [resourceList, setResourceList] = useState<{key: string, url: string}[]>(
    form.getValues("resource_urls") || []
  )
  const [competitorList, setCompetitorList] = useState<{name?: string, url: string}[]>(
    form.getValues("competitors") || []
  )

  // Add resource entry
  const addResource = () => {
    const newResources = [...resourceList, { key: "", url: "" }]
    setResourceList(newResources)
    form.setValue("resource_urls", newResources)
  }

  // Remove resource entry
  const removeResource = (index: number) => {
    const newResources = resourceList.filter((_, i) => i !== index)
    setResourceList(newResources)
    form.setValue("resource_urls", newResources)
  }

  // Add competitor entry
  const addCompetitor = () => {
    const newCompetitors = [...competitorList, { name: "", url: "" }]
    setCompetitorList(newCompetitors)
    form.setValue("competitors", newCompetitors as any)
  }

  // Remove competitor entry
  const removeCompetitor = (index: number) => {
    const newCompetitors = competitorList.filter((_, i) => i !== index)
    setCompetitorList(newCompetitors)
    form.setValue("competitors", newCompetitors as any)
  }

  // Handle logo upload
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0]
      if (file) {
        const reader = new FileReader()
        reader.onloadend = () => {
          form.setValue("logo_url", reader.result as string)
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

  const focusConfig = focusModeConfig(form.watch("focusMode"))

  return (
    <>
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Site Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
            <div className="min-w-[240px] flex-shrink-0">
              <FormField
                control={form.control}
                name="logo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo</FormLabel>
                    <FormControl>
                      <div
                        {...getRootProps()}
                        className={cn(
                          "relative flex h-40 w-40 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-center transition-colors hover:bg-gray-100",
                          field.value && "border-0 p-0"
                        )}
                      >
                        <input {...getInputProps()} />
                        {field.value ? (
                          <Image
                            src={field.value}
                            alt="Logo"
                            fill
                            className="object-contain p-2"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <UploadCloud className="h-8 w-8 text-gray-400" />
                            <p className="text-sm text-gray-500">
                              Drag & drop or click to upload
                            </p>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
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
                    <FormLabel>Site Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Awesome Site" {...field} />
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
                    <FormLabel>Site URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
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
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="A brief description of your site"
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
      
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Resources & Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          {resourceList.map((resource, index) => (
            <div key={index} className="flex items-center space-x-2">
              <FormField
                control={form.control}
                name={`resource_urls.${index}.key`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
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
          <Button
            variant="outline"
            className="mt-2"
            type="button"
            onClick={addResource}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Resource
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Competitors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          {competitorList.map((competitor, index) => (
            <div key={index} className="flex items-center space-x-2">
              <FormField
                control={form.control}
                name={`competitors.${index}.name`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        placeholder="Competitor name"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          const newCompetitors = [...competitorList]
                          newCompetitors[index].name = e.target.value
                          setCompetitorList(newCompetitors)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`competitors.${index}.url`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
                        placeholder="https://competitor.com"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          const newCompetitors = [...competitorList]
                          newCompetitors[index].url = e.target.value
                          setCompetitorList(newCompetitors)
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
                onClick={() => removeCompetitor(index)}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            className="mt-2"
            type="button"
            onClick={addCompetitor}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Competitor
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">AI Focus Mode</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Adjust the focus balance between sales conversion and user growth
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="focusMode"
              render={({ field }) => (
                <FormItem>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-blue-600">Sales</span>
                      <span className={`text-xl font-bold ${focusConfig.color}`}>
                        {focusConfig.label}
                      </span>
                      <span className="text-sm font-medium text-green-600">Growth</span>
                    </div>
                    <FormControl>
                      <Slider
                        value={[field.value]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(value) => {
                          field.onChange(value[0])
                        }}
                        className={`${focusConfig.sliderClass}`}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">{focusConfig.description}</p>
                    <div className="mt-4 space-y-3">
                      <h4 className="text-sm font-semibold">Agent Behavior:</h4>
                      <ul className="space-y-2">
                        {focusConfig.features.map((feature: string, i: number) => (
                          <li key={i} className="text-sm flex items-start">
                            <div className="rounded-full h-1.5 w-1.5 mt-1.5 mr-2 bg-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>
    </>
  )
} 