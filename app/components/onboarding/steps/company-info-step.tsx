"use client"

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../ui/form"
import { Input } from "../../ui/input"
import { Textarea } from "../../ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select"
import { COMPANY_SIZES, INDUSTRIES } from "../constants/onboarding-constants"

interface CompanyInfoStepProps {
  form: any
}

export function CompanyInfoStep({ form }: CompanyInfoStepProps) {
  return (
    <div className="space-y-6">
      <div className="bg-muted/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-muted-foreground">
          <strong>💡 Why this helps:</strong> Company information helps our AI provide more relevant recommendations and better understand your business context.
        </p>
      </div>

      <FormField
        control={form.control}
        name="about"
        render={({ field }) => (
          <FormItem>
            <FormLabel>About Your Company</FormLabel>
            <FormControl>
              <Textarea 
                className="resize-none min-h-[80px]"
                placeholder="Tell us about your company..."
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="company_size"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Company Size</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
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
                value={field.value}
                onValueChange={(value) => field.onChange(value)}
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

      <div className="space-y-4">
        <FormLabel className="text-base font-medium">Business Goals (Optional)</FormLabel>
        <div className="grid md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="goals.quarterly"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quarterly Goals</FormLabel>
                <FormControl>
                  <Textarea 
                    className="resize-none min-h-[60px]"
                    placeholder="What do you want to achieve this quarter?"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="goals.yearly"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Yearly Goals</FormLabel>
                <FormControl>
                  <Textarea 
                    className="resize-none min-h-[60px]"
                    placeholder="What do you want to achieve this year?"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="space-y-4">
        <FormLabel className="text-base font-medium">SWOT Analysis (Optional but recommended)</FormLabel>
        <p className="text-sm text-muted-foreground mb-4">
          This helps our AI agents better understand your business context for more creative and strategic recommendations.
        </p>
        <div className="grid grid-cols-1 gap-4">
          <FormField
            control={form.control}
            name="swot.strengths"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Strengths</FormLabel>
                <FormControl>
                  <Textarea 
                    className="resize-none min-h-[80px]"
                    placeholder="What does your company do well?"
                    {...field}
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
                    className="resize-none min-h-[80px]"
                    placeholder="Where could your company improve?"
                    {...field}
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
                    className="resize-none min-h-[80px]"
                    placeholder="What opportunities exist for your company?"
                    {...field}
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
                    className="resize-none min-h-[80px]"
                    placeholder="What threats does your company face?"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  )
} 