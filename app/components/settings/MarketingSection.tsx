"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect } from "react"
import { type SiteFormValues, type MarketingChannel, getFocusModeConfig } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, Tag, Link, Globe, AppWindow, ChevronDown, ChevronRight } from "../ui/icons"
import { Slider } from "../ui/slider"
import { Switch } from "../ui/switch"
import { EmptyCard } from "../ui/empty-card"

interface MarketingSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

export function MarketingSection({ active, onSave }: MarketingSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [savingCard, setSavingCard] = useState<string | null>(null)
  const [channelsList, setChannelsList] = useState<MarketingChannel[]>(
    form.getValues("marketing_channels") || []
  )

  const handleSave = async (cardId: string) => {
    if (!onSave) return
    setSavingCard(cardId)
    try {
      const formData = form.getValues()
      await onSave(formData)
      form.reset(formData)
    } catch (error) {
      console.error("Error saving marketing:", error)
    } finally {
      setSavingCard(null)
    }
  }
  const [competitorList, setCompetitorList] = useState<{name?: string, url: string}[]>(
    form.getValues("competitors") || []
  )

  // Sync competitors when form values change
  useEffect(() => {
    // Use a subscription instead of putting watch in dependencies
    const subscription = form.watch((value, { name }) => {
      if (name === 'competitors' && value.competitors && Array.isArray(value.competitors)) {
        setCompetitorList(value.competitors as any);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form])

  // Add channel
  const addChannel = () => {
    const newChannels = [{ name: "" }, ...channelsList]
    setChannelsList(newChannels)
    form.setValue("marketing_channels", newChannels)
  }

  // Remove channel
  const removeChannel = (index: number) => {
    const newChannels = channelsList.filter((_, i) => i !== index)
    setChannelsList(newChannels)
    form.setValue("marketing_channels", newChannels)
  }

  // Add competitor entry
  const addCompetitor = () => {
    const newCompetitors = [{ name: "", url: "" }, ...competitorList]
    setCompetitorList(newCompetitors)
    form.setValue("competitors", newCompetitors as any, { shouldDirty: true, shouldValidate: true })
  }

  // Remove competitor entry
  const removeCompetitor = (index: number) => {
    const newCompetitors = competitorList.filter((_, i) => i !== index)
    setCompetitorList(newCompetitors)
    form.setValue("competitors", newCompetitors as any, { shouldDirty: true, shouldValidate: true })
  }

  if (!active) return null

  // Get focus mode value once and use memoization if needed
  const focusModeValue = form.getValues("focusMode")
  const focusConfig = getFocusModeConfig(focusModeValue)

  return (
    <>
      <SectionCard id="ai-focus-mode">
        <SectionCardHeader>
          <SectionCardTitle>AI Focus Mode</SectionCardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Adjust the focus balance between sales conversion and user growth
          </p>
        </SectionCardHeader>
        <SectionCardContent>
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
                      <div className="py-4 relative">
                        <style jsx global>{`
                          /* Ensure slider track has proper border radius */
                          [data-radix-slider-track] {
                            border-radius: 9999px !important;
                            overflow: hidden !important;
                          }
                          
                          /* Ensure slider range has proper border radius */
                          [data-radix-slider-range] {
                            border-radius: 9999px !important;
                          }
                        `}</style>
                        <Slider
                          value={[field.value]}
                          min={0}
                          max={100}
                          step={1}
                          onValueChange={(value) => {
                            field.onChange(value[0])
                          }}
                          className={`style-slider-thumb ${focusConfig.sliderClass}`}
                        />
                      </div>
                    </FormControl>
                    <p className="text-sm text-muted-foreground">{focusConfig.description}</p>
                    <div className="mt-4 space-y-3">
                      <h4 className="text-sm font-semibold">Agent Behavior:</h4>
                      <ul className="space-y-2">
                        {focusConfig.features.map((feature: string, i: number) => (
                          <li key={i} className="text-sm flex items-start">
                            <div className="rounded-full font-inter h-1.5 w-1.5 mt-1.5 mr-2 bg-primary" />
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
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" size="sm"
            onClick={() => handleSave('ai-focus-mode')}
            disabled={savingCard === 'ai-focus-mode' || !form.formState.isDirty}
          >
            {savingCard === 'ai-focus-mode' ? "Saving..." : "Save"}
          </Button>
        </SectionCardFooter>
      </SectionCard>

      <SectionCard id="business-model">
        <SectionCardHeader>
          <SectionCardTitle>Business Model</SectionCardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Select your business model focus areas. You can enable multiple models.
          </p>
        </SectionCardHeader>
        <SectionCardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormField
                control={form.control}
                name="businessModel.b2b"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium">B2B</FormLabel>
                      <FormDescription>
                        Business to Business focus
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="businessModel.b2c"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium">B2C</FormLabel>
                      <FormDescription>
                        Business to Consumer focus
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="businessModel.b2b2c"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base font-medium">B2B2C</FormLabel>
                      <FormDescription>
                        Business to Business to Consumer
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" size="sm"
            onClick={() => handleSave('business-model')}
            disabled={savingCard === 'business-model' || !form.formState.isDirty}
          >
            {savingCard === 'business-model' ? "Saving..." : "Save"}
          </Button>
        </SectionCardFooter>
      </SectionCard>

      <SectionCard id="marketing-budget">
        <SectionCardHeader>
          <SectionCardTitle>Marketing Budget (in USD)</SectionCardTitle>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="marketing_budget.total"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Budget</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0.00 USD"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      value={field.value || 0}
                    />
                  </FormControl>
                  <FormDescription>
                    Total marketing budget for this site
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="marketing_budget.available"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Available Budget</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0.00 USD"
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                      value={field.value || 0}
                    />
                  </FormControl>
                  <FormDescription>
                    Remaining budget available to spend
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" size="sm"
            onClick={() => handleSave('marketing-budget')}
            disabled={savingCard === 'marketing-budget' || !form.formState.isDirty}
          >
            {savingCard === 'marketing-budget' ? "Saving..." : "Save"}
          </Button>
        </SectionCardFooter>
      </SectionCard>


      <SectionCard id="catalog-redirect">
        <SectionCardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <SectionCardTitle>Products & Services</SectionCardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Products and services have moved to the new dedicated Catalog module.
              </p>
            </div>
            <a href="/catalog">
              <Button
                variant="outline"
                size="sm"
                type="button"
              >
                <AppWindow className="mr-2 h-4 w-4" />
                Go to Catalog
              </Button>
            </a>
          </div>
        </SectionCardHeader>
      </SectionCard>

      <SectionCard id="competitors">
        <SectionCardHeader>
          <div className="flex items-center justify-between">
            <div>
              <SectionCardTitle>Competitors</SectionCardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Add your main competitors for market analysis
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={addCompetitor}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Competitor
            </Button>
          </div>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          {(!competitorList || competitorList.length === 0) ? (
            <EmptyCard 
              icon={<AppWindow className="h-10 w-10" />}
              title="No competitors added"
              description="Keep track of your competitors to help agents position your brand."
              variant="fancy"
            />
          ) : (
          competitorList.map((competitor, index) => (
            <div key={index} className="flex items-center space-x-2">
              <FormField
                control={form.control}
                name={`competitors.${index}.name`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <div className="relative">
                        <AppWindow className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-12 h-12 text-base"
                          placeholder="Competitor name"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            const newCompetitors = [...competitorList]
                            newCompetitors[index].name = e.target.value
                            setCompetitorList(newCompetitors)
                            form.setValue("competitors", newCompetitors as any)
                          }}
                        />
                      </div>
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
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-12 h-12 text-base"
                          placeholder="https://competitor.com"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            const newCompetitors = [...competitorList]
                            newCompetitors[index].url = e.target.value
                            setCompetitorList(newCompetitors)
                            form.setValue("competitors", newCompetitors as any)
                          }}
                        />
                      </div>
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
          )))}
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" size="sm"
            onClick={() => handleSave('competitors')}
            disabled={savingCard === 'competitors' || !form.formState.isDirty}
          >
            {savingCard === 'competitors' ? "Saving..." : "Save"}
          </Button>
        </SectionCardFooter>
      </SectionCard>

      <SectionCard id="marketing-channels">
        <SectionCardHeader>
          <div className="flex items-center justify-between">
            <div>
              <SectionCardTitle>Marketing Channels</SectionCardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Add your marketing channels and platforms
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={addChannel}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Channel
            </Button>
          </div>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          {(!channelsList || channelsList.length === 0) ? (
            <EmptyCard 
              icon={<Globe className="h-10 w-10" />}
              title="No marketing channels"
              description="Add the channels you use to reach your customers."
              variant="fancy"
            />
          ) : (
          channelsList.map((channel, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <FormField
                control={form.control}
                name={`marketing_channels.${index}.name`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-12 h-12 text-base"
                          placeholder="Channel name (e.g. Google Ads, Email Marketing)"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            const newChannels = [...channelsList]
                            newChannels[index] = {
                              ...newChannels[index],
                              name: e.target.value
                            }
                            setChannelsList(newChannels)
                            form.setValue("marketing_channels", newChannels)
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                size="icon"
                variant="ghost"
                type="button"
                onClick={() => removeChannel(index)}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          )))}
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" size="sm"
            onClick={() => handleSave('marketing-channels')}
            disabled={savingCard === 'marketing-channels' || !form.formState.isDirty}
          >
            {savingCard === 'marketing-channels' ? "Saving..." : "Save"}
          </Button>
        </SectionCardFooter>
      </SectionCard>

    </>
  )
} 