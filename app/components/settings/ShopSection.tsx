"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect, useRef } from "react"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "../ui/card"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { Store, Image as ImageIcon, Truck, ShieldCheck, RotateCcw, PlusCircle, Trash2, CreditCard, Loader } from "../ui/icons"
import { EmptyCard } from "../ui/empty-card"
import { uploadAssetFile } from "@/app/assets/actions"

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
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Keep local state in sync if form gets reset or hydrated
    const currentBadges = form.getValues("shop.trust_badges") || []
    setBadgesList(currentBadges)
    
    const subscription = form.watch((value, { name }) => {
      if (!name || name.startsWith('shop.trust_badges')) {
        setBadgesList(value.shop?.trust_badges || [])
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingImage(true)
    try {
      const { path, error } = await uploadAssetFile(file)
      if (error) {
        console.error("Error uploading image:", error)
        return
      }
      if (path) {
        form.setValue("shop.hero_image_url", path, { shouldDirty: true, shouldValidate: true })
      }
    } catch (error) {
      console.error("Failed to upload image:", error)
    } finally {
      setIsUploadingImage(false)
      // Clear the input to allow uploading the same image again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  if (!active) return null

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card id="shop-hero" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <Store className="h-5 w-5 text-gray-500" />
            Storefront Hero
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">Configure the main banner of your shop. Leave empty to hide.</p>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
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
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef} 
                      accept="image/*"
                      onChange={handleImageUpload} 
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="shrink-0"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                    >
                      {isUploadingImage ? <Loader className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    </Button>
                  </div>
                </FormControl>
                <FormDescription>Optional background image for the hero section.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => handleSave('shop-hero')}
            disabled={savingCard === 'shop-hero'}
          >
            {savingCard === 'shop-hero' ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Trust & Shipping */}
      <Card id="shop-trust" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gray-500" />
            Trust & Policies
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">Configure shipping thresholds and trust signals to boost conversions.</p>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="shop.shipping_cost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Global Shipping Cost</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input 
                        type="number" 
                        placeholder="0.00" 
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
                  <FormDescription>
                    Fixed amount charged for shipping. For distance/weight-based quotes, enable Dynamic Pricing on the product instead.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="shop.delivery_time_min"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery time (min)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="30" 
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : parseInt(e.target.value, 10)
                        field.onChange(val)
                      }}
                    />
                  </FormControl>
                  <FormDescription>Minimum delivery or prep time in minutes.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shop.delivery_time_max"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>to (max)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="45" 
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value === "" ? null : parseInt(e.target.value, 10)
                        field.onChange(val)
                      }}
                    />
                  </FormControl>
                  <FormDescription>Maximum delivery time (optional).</FormDescription>
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
                  icon={<ShieldCheck />}
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
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => handleSave('shop-trust')}
            disabled={savingCard === 'shop-trust'}
          >
            {savingCard === 'shop-trust' ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>

      {/* Payment & Delivery Policy */}
      <Card id="shop-payments" className="border dark:border-white/5 border-black/5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-gray-500" />
            Payment & Delivery Policy
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">Configure default payment methods and delivery options for your marketplace items. Products can still override these settings.</p>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
          <div className="grid grid-cols-1 gap-8">
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Accepted Payment Methods</h4>
              <p className="text-sm text-gray-500 mb-4">Choose how customers can pay during checkout.</p>
              
              <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
                <FormField
                  control={form.control}
                  name="shop.payment_methods"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                      <div className="space-y-0.5">
                        <FormLabel className="font-medium flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-blue-500" />
                          Online Card Payment (Stripe)
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Customers pay online during checkout using Stripe.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value?.includes('card')}
                          onCheckedChange={(checked) => {
                            const val = field.value || []
                            field.onChange(checked 
                              ? [...val, 'card'] 
                              : val.filter((v: string) => v !== 'card')
                            )
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="shop.payment_methods"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                      <div className="space-y-0.5">
                        <FormLabel className="font-medium flex items-center gap-2">
                          <Store className="w-4 h-4 text-emerald-500" />
                          Cash on Pickup
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Customers complete checkout unpaid and pay cash at the store.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value?.includes('cash_on_pickup')}
                          onCheckedChange={(checked) => {
                            const val = field.value || []
                            field.onChange(checked 
                              ? [...val, 'cash_on_pickup'] 
                              : val.filter((v: string) => v !== 'cash_on_pickup')
                            )
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shop.payment_methods"
                  render={({ field }) => (
                    <div className="space-y-4">
                      <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                        <div className="space-y-0.5">
                          <FormLabel className="font-medium flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-indigo-500" />
                            Bank Transfer
                          </FormLabel>
                          <FormDescription className="text-xs">
                            Customers complete checkout unpaid. You verify the transfer manually.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value?.includes('bank_transfer')}
                            onCheckedChange={(checked) => {
                              const val = field.value || []
                              field.onChange(checked 
                                ? [...val, 'bank_transfer'] 
                                : val.filter((v: string) => v !== 'bank_transfer')
                              )
                            }}
                          />
                        </FormControl>
                      </FormItem>
                      
                      {field.value?.includes('bank_transfer') && (
                        <div className="space-y-4 p-4 border rounded-lg bg-background mt-2">
                          <h5 className="text-sm font-medium">Bank Account Details</h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="shop.bank_transfer.bank_name"
                              render={({ field: subField }) => (
                                <FormItem>
                                  <FormLabel>Bank Name</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g. Chase, Bank of America" {...subField} value={subField.value || ''} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="shop.bank_transfer.account_holder"
                              render={({ field: subField }) => (
                                <FormItem>
                                  <FormLabel>Account Holder</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g. Acme Corp" {...subField} value={subField.value || ''} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="shop.bank_transfer.account_number"
                              render={({ field: subField }) => (
                                <FormItem>
                                  <FormLabel>Account Number / IBAN</FormLabel>
                                  <FormControl>
                                    <Input placeholder="e.g. 123456789" {...subField} value={subField.value || ''} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name="shop.bank_transfer.routing_number"
                              render={({ field: subField }) => (
                                <FormItem>
                                  <FormLabel>Routing Number / SWIFT / BIC</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Optional" {...subField} value={subField.value || ''} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <div className="md:col-span-2">
                              <FormField
                                control={form.control}
                                name="shop.bank_transfer.instructions"
                                render={({ field: subField }) => (
                                  <FormItem>
                                    <FormLabel>Additional Instructions</FormLabel>
                                    <FormControl>
                                      <Input placeholder="e.g. Please include order number in transfer reference." {...subField} value={subField.value || ''} />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Default Delivery Options</h4>
              <p className="text-sm text-gray-500 mb-4">Fallback options for physical products without specific delivery settings.</p>
              
              <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
                <FormField
                  control={form.control}
                  name="shop.default_delivery_options"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                      <div className="space-y-0.5">
                        <FormLabel className="font-medium flex items-center gap-2">
                          <Truck className="w-4 h-4 text-orange-500" />
                          Ship to Customer
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Deliver physical goods to customer's address.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value?.includes('ship')}
                          onCheckedChange={(checked) => {
                            const val = field.value || []
                            field.onChange(checked 
                              ? [...val, 'ship'] 
                              : val.filter((v: string) => v !== 'ship')
                            )
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="shop.default_delivery_options"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                      <div className="space-y-0.5">
                        <FormLabel className="font-medium flex items-center gap-2">
                          <Store className="w-4 h-4 text-purple-500" />
                          Store Pickup
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Customers pick up their order at your location.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value?.includes('pickup')}
                          onCheckedChange={(checked) => {
                            const val = field.value || []
                            field.onChange(checked 
                              ? [...val, 'pickup'] 
                              : val.filter((v: string) => v !== 'pickup')
                            )
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shop.default_delivery_options"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                      <div className="space-y-0.5">
                        <FormLabel className="font-medium flex items-center gap-2">
                          <Store className="w-4 h-4 text-blue-500" />
                          Consume Here
                        </FormLabel>
                        <FormDescription className="text-xs">
                          Customers consume their order at your location.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value?.includes('dine_in')}
                          onCheckedChange={(checked) => {
                            const val = field.value || []
                            field.onChange(checked 
                              ? [...val, 'dine_in'] 
                              : val.filter((v: string) => v !== 'dine_in')
                            )
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-8 py-6 bg-muted/30 border-t flex justify-end">
          <Button 
            type="button" 
            variant="outline"
            onClick={() => handleSave('shop-payments')}
            disabled={savingCard === 'shop-payments'}
          >
            {savingCard === 'shop-payments' ? "Saving..." : "Save"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}