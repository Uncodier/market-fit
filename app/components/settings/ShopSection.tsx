"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { Store, Image as ImageIcon, Truck, ShieldCheck, RotateCcw, PlusCircle, Trash2 } from "../ui/icons"

interface ShopSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
}

const AVAILABLE_ICONS = [
  { value: "Truck", label: "Delivery Truck", icon: Truck },
  { value: "ShieldCheck", label: "Shield Check", icon: ShieldCheck },
  { value: "RotateCcw", label: "Rotate / Returns", icon: RotateCcw }
]

export function ShopSection({ active, onSave }: ShopSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [savingCard, setSavingCard] = useState<string | null>(null)
  const [badgesList, setBadgesList] = useState<any[]>(
    form.getValues("shop.trust_badges") || []
  )

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'shop.trust_badges' && value.shop?.trust_badges) {
        setBadgesList(value.shop.trust_badges as any)
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const handleSave = async (cardId: string) => {
    if (!onSave) return
    setSavingCard(cardId)
    try {
      const formData = form.getValues()
      await onSave(formData)
    } catch (error) {
      console.error("Error saving shop settings:", error)
    } finally {
      setSavingCard(null)
    }
  }

  const addBadge = () => {
    if (badgesList.length >= 3) return
    const newBadges = [...badgesList, { title: "", subtitle: "", icon: "Truck" }]
    setBadgesList(newBadges)
    form.setValue("shop.trust_badges", newBadges as any, { shouldDirty: true, shouldValidate: true })
  }

  const removeBadge = (index: number) => {
    const newBadges = badgesList.filter((_, i) => i !== index)
    setBadgesList(newBadges)
    form.setValue("shop.trust_badges", newBadges as any, { shouldDirty: true, shouldValidate: true })
  }

  if (!active) return null

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card id="shop-hero" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="border-b dark:border-white/5 border-black/5 bg-gray-50/50 dark:bg-zinc-900/50 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Store className="h-5 w-5 text-gray-500" />
            Storefront Hero
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">Configure the main banner of your shop. Leave empty to hide.</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="shop.hero_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hero Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Premium quality. Exceptional design." {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>The main headline displayed on the shop homepage.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shop.hero_cta_label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Call to Action Label</FormLabel>
                  <FormControl>
                    <Input placeholder="Shop Now" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>Text for the main button in the hero section.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="shop.hero_subtitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hero Subtitle</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Discover our latest arrivals designed to elevate your everyday experience."
                    className="min-h-[100px]"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormDescription>Supporting text below the main headline.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="shop.hero_image_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hero Image URL</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Input placeholder="https://..." {...field} value={field.value || ""} />
                    <Button type="button" variant="outline" size="icon" className="shrink-0">
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </FormControl>
                <FormDescription>Optional background image for the hero section.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="border-t dark:border-white/5 border-black/5 bg-gray-50/30 dark:bg-zinc-900/30 py-3 flex justify-end">
          <Button 
            type="button" 
            size="sm"
            onClick={() => handleSave('shop-hero')}
            disabled={savingCard === 'shop-hero'}
            className="rounded-full shadow-sm"
          >
            {savingCard === 'shop-hero' ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Trust & Shipping */}
      <Card id="shop-trust" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="border-b dark:border-white/5 border-black/5 bg-gray-50/50 dark:bg-zinc-900/50 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gray-500" />
            Trust & Shipping
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">Configure shipping thresholds and trust signals to boost conversions.</p>
        </CardHeader>
        <CardContent className="pt-6 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="shop.free_shipping_threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Free Shipping Threshold</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input 
                        type="number" 
                        placeholder="50" 
                        className="pl-7"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? null : parseFloat(e.target.value)
                          field.onChange(val)
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Leave empty if you don't offer free shipping over a certain amount.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shop.return_policy_summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Return Policy Summary</FormLabel>
                  <FormControl>
                    <Input placeholder="30-Day Returns" {...field} value={field.value || ""} />
                  </FormControl>
                  <FormDescription>Short text summarizing your return policy (e.g., "30-Day Returns").</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <FormLabel>Trust Badges</FormLabel>
                <FormDescription>Display up to 3 trust signals below the hero section.</FormDescription>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addBadge}
                disabled={badgesList.length >= 3}
                className="gap-2"
              >
                <PlusCircle className="h-4 w-4" />
                Add Badge
              </Button>
            </div>

            <div className="space-y-3">
              {badgesList.length === 0 ? (
                <EmptyCard 
                  icon={ShieldCheck}
                  title="No trust badges"
                  description="Add badges like 'Fast Shipping' or 'Secure Checkout' to build trust."
                />
              ) : (
                badgesList.map((badge, index) => (
                  <div key={index} className="flex items-start gap-4 p-4 border rounded-xl bg-gray-50/50">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`shop.trust_badges.${index}.title`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Fast Shipping" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`shop.trust_badges.${index}.subtitle`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Subtitle</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. On orders over $50" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`shop.trust_badges.${index}.icon`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Icon</FormLabel>
                            <FormControl>
                              <select 
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={field.value}
                                onChange={field.onChange}
                              >
                                {AVAILABLE_ICONS.map(i => (
                                  <option key={i.value} value={i.value}>{i.label}</option>
                                ))}
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeBadge(index)}
                      className="mt-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t dark:border-white/5 border-black/5 bg-gray-50/30 dark:bg-zinc-900/30 py-3 flex justify-end">
          <Button 
            type="button" 
            size="sm"
            onClick={() => handleSave('shop-trust')}
            disabled={savingCard === 'shop-trust'}
            className="rounded-full shadow-sm"
          >
            {savingCard === 'shop-trust' ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}