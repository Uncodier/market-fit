"use client"

import { useFormContext } from "react-hook-form"
import { useState } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2 } from "../ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

interface CompanySectionProps {
  active: boolean
}

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1001+", label: "1001+ employees" }
]

const INDUSTRIES = [
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "education", label: "Education" },
  { value: "retail", label: "Retail" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "entertainment", label: "Entertainment" },
  { value: "food", label: "Food & Beverage" },
  { value: "travel", label: "Travel & Hospitality" },
  { value: "real_estate", label: "Real Estate" },
  { value: "professional_services", label: "Professional Services" },
  { value: "other", label: "Other" }
]

export function CompanySection({ active }: CompanySectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [locationsList, setLocationsList] = useState<{name: string, address?: string, country?: string}[]>(
    form.getValues("locations") || []
  )

  // Add location
  const addLocation = () => {
    const newLocations = [...locationsList, { name: "", address: "", country: "" }]
    setLocationsList(newLocations)
    form.setValue("locations", newLocations)
  }

  // Remove location
  const removeLocation = (index: number) => {
    const newLocations = locationsList.filter((_, i) => i !== index)
    setLocationsList(newLocations)
    form.setValue("locations", newLocations)
  }

  if (!active) return null

  return (
    <>
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Company Profile</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Basic information about your company
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <FormField
            control={form.control}
            name="about"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Tell us about your company..."
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>
                  A brief description of your company, mission, and values.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="company_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Size</FormLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company size" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COMPANY_SIZES.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <Select
                    value={field.value || ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INDUSTRIES.map((industry) => (
                        <SelectItem key={industry.value} value={industry.value}>
                          {industry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Business Goals</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Set your company goals for different time periods
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <FormField
            control={form.control}
            name="goals.quarter"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quarter Goals</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What do you want to achieve this quarter?"
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="goals.year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year Goals</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What do you want to achieve this year?"
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="goals.five_year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>5 Year Goals</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What do you want to achieve in the next 5 years?"
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="goals.ten_year"
            render={({ field }) => (
              <FormItem>
                <FormLabel>10 Year Goals</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What do you want to achieve in the next 10 years?"
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
          <CardTitle className="text-xl font-semibold">Locations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          {locationsList.map((location, index) => (
            <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start mb-4">
              <FormField
                control={form.control}
                name={`locations.${index}.name`}
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel className={index !== 0 ? "sr-only" : undefined}>
                      Location Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="HQ, Branch Office, etc."
                        {...field}
                        onChange={(e) => {
                          field.onChange(e)
                          const newLocations = [...locationsList]
                          newLocations[index] = {
                            ...newLocations[index],
                            name: e.target.value
                          }
                          setLocationsList(newLocations)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`locations.${index}.address`}
                render={({ field }) => (
                  <FormItem className="md:col-span-5">
                    <FormLabel className={index !== 0 ? "sr-only" : undefined}>
                      Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Street address"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          field.onChange(e)
                          const newLocations = [...locationsList]
                          newLocations[index] = {
                            ...newLocations[index],
                            address: e.target.value
                          }
                          setLocationsList(newLocations)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`locations.${index}.country`}
                render={({ field }) => (
                  <FormItem className="md:col-span-3">
                    <FormLabel className={index !== 0 ? "sr-only" : undefined}>
                      Country
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Country"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          field.onChange(e)
                          const newLocations = [...locationsList]
                          newLocations[index] = {
                            ...newLocations[index],
                            country: e.target.value
                          }
                          setLocationsList(newLocations)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-end justify-center md:justify-start md:col-span-1">
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => removeLocation(index)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            className="mt-2"
            type="button"
            onClick={addLocation}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Location
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">SWOT Analysis</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Analyze your company's strengths, weaknesses, opportunities, and threats
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 px-8 pb-8">
          <FormField
            control={form.control}
            name="swot.strengths"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Strengths</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What does your company do well?"
                    className="min-h-[120px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="swot.weaknesses"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weaknesses</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Where could your company improve?"
                    className="min-h-[120px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="swot.opportunities"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Opportunities</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What opportunities exist for your company?"
                    className="min-h-[120px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="swot.threats"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Threats</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What threats does your company face?"
                    className="min-h-[120px]"
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
    </>
  )
} 