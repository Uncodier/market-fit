"use client"

import { Slider } from "../ui/slider"
import { FormControl, FormField, FormItem } from "../ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"

import { cn } from "@/lib/utils"

import type { useCreateSiteForm } from "./use-create-site-form"
export function SiteFocusModeCard({ form, getFocusModeConfig }: ReturnType<typeof useCreateSiteForm>) {
return (          <Card className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardHeader className="px-8 py-6">
              <CardTitle className="text-xl font-semibold">Focus Mode</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8 px-8 pb-8">
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
                            "py-6 px-6",
                            "[&_[role=slider]]:h-6",
                            "[&_[role=slider]]:w-6",
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
                            "[&]:dark:bg-gray-800",
                            "[&]:rounded-full",
                            {
                              "slider-sales-strong [&_[role=slider]]:bg-blue-700 [&_.range]:bg-blue-700 [&]:bg-blue-100 dark:[&]:bg-blue-950/50": field.value <= 20,
                              "slider-sales-moderate [&_[role=slider]]:bg-blue-600 [&_.range]:bg-blue-600 [&]:bg-blue-50 dark:[&]:bg-blue-900/40": field.value > 20 && field.value <= 40,
                              "slider-balanced-sales [&_[role=slider]]:bg-purple-600 [&_.range]:bg-purple-500 [&]:bg-purple-50 dark:[&]:bg-purple-900/40": field.value > 40 && field.value <= 49,
                              "slider-balanced-perfect [&_[role=slider]]:bg-purple-600 [&_.range]:bg-purple-600 [&]:bg-purple-100 dark:[&]:bg-purple-950/50": field.value === 50,
                              "slider-balanced-growth [&_[role=slider]]:bg-purple-600 [&_.range]:bg-purple-500 [&]:bg-purple-50 dark:[&]:bg-purple-900/40": field.value > 50 && field.value <= 60,
                              "slider-growth-moderate [&_[role=slider]]:bg-green-600 [&_.range]:bg-green-500 [&]:bg-green-50 dark:[&]:bg-green-900/40": field.value > 60 && field.value <= 80,
                              "slider-growth-strong [&_[role=slider]]:bg-green-600 [&_.range]:bg-green-600 [&]:bg-green-100 dark:[&]:bg-green-950/50": field.value > 80
                            }
                          )}
                        />
                        <div className="mt-4">
                          <h3 className={cn("text-lg font-semibold", getFocusModeConfig(field.value).color)}>
                            {getFocusModeConfig(field.value).label}
                          </h3>
                          <p className="text-sm text-foreground mt-1">
                            {getFocusModeConfig(field.value).description}
                          </p>
                          <ul className="mt-4 space-y-2">
                            {getFocusModeConfig(field.value).features.map((feature, index) => (
                              <li key={index} className="text-sm text-foreground flex items-start">
                                <span className="mr-2">•</span>
                                {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
)
}
