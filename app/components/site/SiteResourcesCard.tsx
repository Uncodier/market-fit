"use client"

import { Input } from "../ui/input"

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

import { PlusCircle, Link, Tag } from "@/app/components/ui/icons"
import { Button } from "../ui/button"

import type { useCreateSiteForm } from "./use-create-site-form"
export function SiteResourcesCard({ form }: ReturnType<typeof useCreateSiteForm>) {
return (          <Card className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Resource URLs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              {form.watch("resource_urls").map((_, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`resource_urls.${index}.key`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Resource Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base" 
                              placeholder="Documentation"
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
                    name={`resource_urls.${index}.url`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Resource URL</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Link className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base" 
                              placeholder="https://docs.example.com"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-xs mt-2" />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full h-12"
                onClick={() => {
                  const current = form.getValues("resource_urls")
                  form.setValue("resource_urls", [...current, { key: "", url: "" }])
                }}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Resource
              </Button>
            </CardContent>
          </Card>
)
}
