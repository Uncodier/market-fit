"use client"

import { Input } from "../ui/input"

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

import { PlusCircle, AppWindow, Link } from "@/app/components/ui/icons"
import { Button } from "../ui/button"

import type { useCreateSiteForm } from "./use-create-site-form"
export function SiteCompetitorsCard({ form }: ReturnType<typeof useCreateSiteForm>) {
return (          <Card className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Competitors</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
              {form.watch("competitors")?.map((_, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`competitors.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Competitor Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <AppWindow className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base" 
                              placeholder="Competitor Inc."
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
                    name={`competitors.${index}.url`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-medium text-foreground">Competitor URL</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Link className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-12 h-12 text-base" 
                              placeholder="https://competitor.com"
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
                  const current = form.getValues("competitors") || []
                  form.setValue("competitors", [...current, { url: "", name: "" }])
                }}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Competitor
              </Button>
            </CardContent>
          </Card>
)
}
