"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Slider } from "../ui/slider"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { useDropzone } from "react-dropzone"
import { UploadCloud, Trash2, PlusCircle, AppWindow, Globe, FileText, Link, Tag } from "@/app/components/ui/icons"
import { Button } from "../ui/button"

const siteFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  url: z.string().url("Must be a valid URL"),
  blogUrl: z.string().url("Must be a valid URL").optional(),
  description: z.string().min(10, "Description must be at least 10 characters"),
  logo_url: z.string().optional(),
  competitors: z.array(z.object({
    url: z.string().url("Must be a valid URL")
  })).min(1).max(5),
  focusMode: z.number().min(0).max(100),
  resource_urls: z.array(z.object({
    key: z.string().min(1, "Name is required"),
    url: z.string().url("Must be a valid URL")
  }))
})

type SiteFormValues = z.infer<typeof siteFormSchema>

interface SiteFormProps {
  initialData?: Partial<SiteFormValues>
  onSubmit: (data: SiteFormValues) => void
}

export function SiteForm({ initialData, onSubmit }: SiteFormProps) {
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      url: initialData?.url || "",
      blogUrl: initialData?.blogUrl || "",
      description: initialData?.description || "",
      logo_url: initialData?.logo_url || "",
      competitors: initialData?.competitors || [{ url: "" }],
      focusMode: initialData?.focusMode || 50,
      resource_urls: initialData?.resource_urls || []
    }
  })

  const getFocusModeConfig = (value: number) => {
    // Strong sales focus (0-20)
    if (value <= 20) {
      return {
        label: "Revenue Maximizer",
        description: "Agents will aggressively pursue sales opportunities and conversions, prioritizing immediate revenue.",
        features: [
          "Agents will proactively suggest premium upgrades in every interaction",
          "Responses focus heavily on ROI and business impact",
          "Strong emphasis on exclusive paid features",
          "Enterprise client queries receive highest priority",
          "Messaging optimized for direct purchase decisions"
        ],
        color: "text-blue-600",
        sliderClass: "bg-blue-600"
      }
    }
    
    // Moderate sales focus (21-40)
    if (value <= 40) {
      return {
        label: "Sales Focus",
        description: "Agents will prioritize conversion opportunities while still providing quality support.",
        features: [
          "Agents regularly suggest premium plans when relevant",
          "Responses emphasize value proposition and business benefits",
          "Most examples demonstrate premium features",
          "High-value customer queries are prioritized",
          "Messaging includes clear calls-to-action for upgrades"
        ],
        color: "text-blue-600",
        sliderClass: "bg-blue-600"
      }
    }
    
    // Slight sales tilt (41-49)
    if (value <= 49) {
      return {
        label: "Balanced (Sales Leaning)",
        description: "Agents will balance support with strategic sales opportunities, with a slight focus on conversions.",
        features: [
          "Agents provide thorough support with occasional upgrade suggestions",
          "Responses blend educational content with commercial benefits",
          "Examples include both free and premium capabilities",
          "Equal attention to all users with slight prioritization of paying customers",
          "Messaging subtly highlights premium value"
        ],
        color: "text-purple-600",
        sliderClass: "bg-purple-600"
      }
    }
    
    // Perfect balance (50)
    if (value === 50) {
      return {
        label: "Perfect Balance",
        description: "Agents will maintain an ideal equilibrium between support, education and commercial opportunities.",
        features: [
          "Agents perfectly balance helpfulness and business objectives",
          "Responses give equal weight to educational and commercial content",
          "Examples show balanced use cases for all user tiers",
          "All users receive identical priority and attention",
          "Messaging combines educational value with subtle commercial elements"
        ],
        color: "text-purple-600",
        sliderClass: "bg-purple-600"
      }
    }
    
    // Slight growth tilt (51-60)
    if (value <= 60) {
      return {
        label: "Balanced (Growth Leaning)",
        description: "Agents will focus on helpful support with user growth in mind, with minimal sales emphasis.",
        features: [
          "Agents prioritize being helpful with minimal sales messaging",
          "Responses focus on user education with rare premium mentions",
          "Examples primarily showcase free features with some premium options",
          "New users receive slightly higher priority",
          "Messaging emphasizes user success with subtle premium references"
        ],
        color: "text-purple-600",
        sliderClass: "bg-purple-600"
      }
    }
    
    // Moderate growth focus (61-80)
    if (value <= 80) {
      return {
        label: "Growth Focus",
        description: "Agents will emphasize user acquisition and retention, with educational content and engagement.",
        features: [
          "Agents focus primarily on user satisfaction and education",
          "Responses provide in-depth guidance without sales pressure",
          "Examples highlight free features and community benefits",
          "New user onboarding is highly prioritized",
          "Messaging centered on long-term user success"
        ],
        color: "text-green-600",
        sliderClass: "bg-green-600"
      }
    }
    
    // Strong growth focus (81-100)
    return {
      label: "Growth Maximizer",
      description: "Agents will exclusively focus on user experience, education, and community building.",
      features: [
        "Agents exclusively provide helpful support with no sales messaging",
        "Responses offer comprehensive educational content and resources",
        "Examples exclusively demonstrate free and community features",
        "New users receive the highest level of attention and care",
        "Messaging entirely focused on user empowerment and success"
      ],
      color: "text-green-600",
      sliderClass: "bg-green-600"
    }
  }

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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Focus Mode</CardTitle>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="focusMode"
              render={({ field }) => (
                <FormItem className="space-y-6">
                  <FormControl>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="grid grid-cols-3 w-full gap-2">
                          <div className="text-center">
                            <div className="text-sm font-medium text-blue-600">Sales</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-medium text-purple-600">Balanced</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-medium text-green-600">Growth</div>
                          </div>
                        </div>
                      </div>
                      <Slider
                        value={[field.value]}
                        onValueChange={([value]) => field.onChange(value)}
                        max={100}
                        step={1}
                        className={cn(
                          "py-4 px-2",
                          "[&_[role=slider]]:h-4",
                          "[&_[role=slider]]:w-4",
                          "[&_[role=slider]]:border-2",
                          "[&_[role=slider]]:border-white",
                          "[&_[role=slider]]:shadow-md",
                          "[&_[role=slider]]:transition-colors",
                          "[&_[role=slider]]:duration-200",
                          "[&_[role=slider]]:rounded-full",
                          "[&_.range]:transition-colors",
                          "[&_.range]:duration-200",
                          "[&]:h-4",
                          "[&]:bg-gray-100",
                          "[&]:rounded-full",
                          {
                            "[&_[role=slider]]:bg-blue-600 [&_.range]:bg-blue-500 [&]:bg-blue-50": field.value <= 20,
                            "[&_[role=slider]]:bg-blue-600 [&_.range]:bg-blue-600 [&]:bg-blue-100": field.value > 20 && field.value <= 33,
                            "[&_[role=slider]]:bg-purple-500 [&_.range]:bg-purple-500 [&]:bg-purple-50": field.value > 33 && field.value <= 45,
                            "[&_[role=slider]]:bg-purple-600 [&_.range]:bg-purple-600 [&]:bg-purple-100": field.value > 45 && field.value <= 66,
                            "[&_[role=slider]]:bg-green-500 [&_.range]:bg-green-500 [&]:bg-green-50": field.value > 66 && field.value <= 80,
                            "[&_[role=slider]]:bg-green-600 [&_.range]:bg-green-600 [&]:bg-green-100": field.value > 80
                          }
                        )}
                      />
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className={cn(
                          "text-lg font-semibold mb-2",
                          getFocusModeConfig(field.value).color
                        )}>
                          {getFocusModeConfig(field.value).label}
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                          {getFocusModeConfig(field.value).description}
                        </p>
                        <div className="space-y-2">
                          {getFocusModeConfig(field.value).features.map((feature, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm">
                              <div className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                getFocusModeConfig(field.value).color
                              )} />
                              {feature}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </FormControl>
                  <FormDescription>
                    Adjust your site's focus to optimize between growth and conversions
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>General Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col space-y-4 sm:flex-row sm:space-x-4 sm:space-y-0">
              <div className="min-w-[240px] flex-shrink-0">
                <FormField
                  control={form.control}
                  name="logo_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-2">Avatar</FormLabel>
                      <FormControl>
                        <div className="w-[240px] h-[240px] relative">
                          {field.value ? (
                            <div className="w-full h-full relative group">
                              <Image
                                src={field.value}
                                alt="Avatar"
                                fill
                                className="object-cover rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => field.onChange("")}
                                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg"
                              >
                                <Trash2 className="h-4 w-4 text-white" />
                              </button>
                            </div>
                          ) : (
                            <div
                              {...getRootProps()}
                              className="w-full h-full rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gray-300 hover:bg-gray-100 transition-colors"
                            >
                              <input {...getInputProps()} />
                              <UploadCloud className="h-8 w-8 text-gray-400" />
                              <div className="text-sm text-center">
                                <p className="font-medium text-gray-600">Click to upload</p>
                                <p className="text-gray-500">or drag and drop</p>
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

              <div className="flex-1 space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>App Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <AppWindow className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input className="pl-10" placeholder="My Application" {...field} />
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
                      <FormLabel>Site URL</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input className="pl-10" placeholder="https://myapp.com" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="blogUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blog URL</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input className="pl-10" placeholder="https://blog.myapp.com" {...field} />
                        </div>
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
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <Textarea 
                        className="pl-10 resize-none min-h-[120px]"
                        placeholder="Describe your application..."
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Competitor Benchmark</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {form.watch("competitors").map((_, index) => (
              <FormField
                key={index}
                control={form.control}
                name={`competitors.${index}.url`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Competitor {index + 1}</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input className="pl-10" placeholder="https://competitor.com" {...field} />
                        </div>
                        {index > 0 && (
                          <Button
                            type="button"
                            onClick={() => {
                              const current = form.getValues("competitors")
                              form.setValue("competitors", current.filter((_, i) => i !== index))
                            }}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            
            {form.watch("competitors").length < 5 && (
              <button
                type="button"
                onClick={() => {
                  const current = form.getValues("competitors")
                  form.setValue("competitors", [...current, { url: "" }])
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add competitor</span>
              </button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resource URLs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {form.watch("resource_urls").map((_, index) => (
              <div key={index} className="flex gap-4">
                <FormField
                  control={form.control}
                  name={`resource_urls.${index}.key`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Resource Name</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input className="pl-10" placeholder="e.g., Documentation" {...field} />
                        </div>
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
                      <FormLabel>URL</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input className="pl-10" placeholder="https://myapp.com/docs" {...field} />
                          </div>
                          {index > 0 && (
                            <Button
                              type="button"
                              onClick={() => {
                                const current = form.getValues("resource_urls")
                                form.setValue("resource_urls", current.filter((_, i) => i !== index))
                              }}
                              className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}
            
            <button
              type="button"
              onClick={() => {
                const current = form.getValues("resource_urls")
                form.setValue("resource_urls", [...current, { key: "", url: "" }])
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add resource</span>
            </button>
          </CardContent>
        </Card>
      </form>
    </Form>
  )
} 