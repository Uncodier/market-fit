"use client"

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../ui/form"
import { Input } from "../../ui/input"
import { Button } from "../../ui/button"
import { Globe, PlusCircle, Trash2 } from "../../ui/icons"

interface MarketingStepProps {
  form: any
  addMarketingChannel: () => void
  removeMarketingChannel: (index: number) => void
}

export function MarketingStep({ form, addMarketingChannel, removeMarketingChannel }: MarketingStepProps) {
  return (
    <div className="space-y-6">
      <div className="bg-muted/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-muted-foreground">
          <strong>💡 Why this helps:</strong> Marketing information allows our AI to provide better insights and recommendations for your campaigns and budget allocation.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="marketing_budget.total"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Budget (USD)</FormLabel>
              <FormControl>
                <Input 
                  type="number"
                  placeholder="0"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="marketing_budget.available"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Available Budget (USD)</FormLabel>
              <FormControl>
                <Input 
                  type="number"
                  placeholder="0"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div>
        <FormLabel className="text-base font-medium mb-4 block">Marketing Channels (Optional)</FormLabel>
        <div className="space-y-3">
          {form.watch("marketing_channels")?.map((_, index) => (
            <div key={index} className="flex items-center gap-2">
              <FormField
                control={form.control}
                name={`marketing_channels.${index}.name`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input 
                          className="pl-10"
                          placeholder="e.g. Google Ads, Email Marketing"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeMarketingChannel(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addMarketingChannel}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Marketing Channel
          </Button>
        </div>
      </div>
    </div>
  )
} 