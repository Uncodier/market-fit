"use client"

import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

import Image from "next/image"
import { cn } from "@/lib/utils"

import { UploadCloud, Trash2, AppWindow, Globe, Tag } from "@/app/components/ui/icons"

import type { useCreateSiteForm } from "./use-create-site-form"
export function SiteInformationCard({ form, getRootProps, getInputProps }: ReturnType<typeof useCreateSiteForm>) {
return (          <Card className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
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
                                className={cn(
                                  "w-full h-full rounded-lg border-2 border-dashed border-input",
                                  "bg-muted flex flex-col items-center justify-center gap-2 cursor-pointer",
                                  "hover:border-input/80 hover:bg-muted/80 transition-colors"
                                )}
                              >
                                <input {...getInputProps()} />
                                <div className="flex flex-col items-center justify-center">
                                  <UploadCloud className="h-8 w-8 text-gray-400 flex-shrink-0 mb-2" />
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
                          className="pl-12 resize-none min-h-[120px] text-base"
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
)
}
