"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useDropzone } from "react-dropzone"
import Image from "next/image"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/app/components/ui/form"
import { Input } from "@/app/components/ui/input"
import { Textarea } from "@/app/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import {
  AppWindow,
  FileText,
  Globe,
  Tag,
  Trash2,
  UploadCloud,
  Plus,
  X
} from "@/app/components/ui/icons"
import { type SiteFormValues, siteFormSchema } from "@/lib/schemas/site"

interface CreateSiteFormProps {
  onSubmit: (data: SiteFormValues) => void
  isSaving?: boolean
  id?: string
}

export function CreateSiteForm({ 
  onSubmit, 
  isSaving,
  id
}: CreateSiteFormProps) {
  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      name: "",
      url: "",
      blogUrl: "",
      description: "",
      logo_url: "",
      competitors: [{ url: "" }],
      focusMode: 50,
      resource_urls: []
    }
  })

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
      <form id={id} onSubmit={form.handleSubmit(onSubmit)} className="space-y-12">
        <div className="space-y-12">
          <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
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
                        <FormLabel className="text-sm font-medium text-gray-700">Logo</FormLabel>
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
                        <FormLabel className="text-sm font-medium text-gray-700">Site Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <AppWindow className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                              className="pl-12 h-12 text-base border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors duration-200" 
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
                        <FormLabel className="text-sm font-medium text-gray-700">Site URL</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                              className="pl-12 h-12 text-base border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors duration-200" 
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
                    name="blogUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-gray-700">Blog URL</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                              className="pl-12 h-12 text-base border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors duration-200" 
                              placeholder="https://blog.example.com"
                              {...field} 
                            />
                          </div>
                        </FormControl>
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
                    <FormLabel className="text-sm font-medium text-gray-700">Description</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Tag className="absolute left-4 top-3 h-4 w-4 text-gray-400" />
                        <Textarea 
                          className="pl-12 resize-none min-h-[120px] text-base border-gray-200 hover:border-gray-300 focus:border-blue-500 transition-colors duration-200"
                          placeholder="Describe your site..."
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs mt-2" />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  )
} 