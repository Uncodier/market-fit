"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import QRCode from "react-qr-code"
import { type SiteFormValues } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { useDropzone } from "react-dropzone"
import { cn } from "@/lib/utils"
import {
  SectionCard,
  SectionCardHeader,
  SectionCardTitle,
  SectionCardDescription,
  SectionCardContent,
  SectionCardFooter,
} from "@/app/components/ui/section-card"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { Store, Image as ImageIcon, Truck, ShieldCheck, RotateCcw, PlusCircle, Trash2, CreditCard, Loader, X, Calendar, Link, Copy, Download } from "../ui/icons"
import { EmptyCard } from "../ui/empty-card"
import { uploadAssetFile } from "@/app/assets/actions"
import { listCatalogCategories, listCatalogItems } from "@/app/catalog/actions"

interface ShopSectionProps {
  active: boolean
  onSave?: (data: SiteFormValues) => void
  siteId?: string
}

const AVAILABLE_ICONS = [
  { value: "Truck", label: "Delivery Truck", icon: Truck },
  { value: "ShieldCheck", label: "Shield Check", icon: ShieldCheck },
  { value: "RotateCcw", label: "Rotate / Returns", icon: RotateCcw }
]

export function ShopSection({ active, onSave, siteId }: ShopSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [savingCard, setSavingCard] = useState<string | null>(null)
  const [badgesList, setBadgesList] = useState<any[]>(
    form.getValues("shop.trust_badges") || []
  )
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [categories, setCategories] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])

  const siteUrl = form.watch("url") || (siteId ? `https://${siteId}.uncodie.com` : "https://uncodie.com")

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl)
      toast.success("URL copied to clipboard")
    } catch (err) {
      toast.error("Failed to copy URL")
    }
  }

  const handleDownloadQR = () => {
    const container = document.getElementById("marketplace-qr-code-container")
    const svg = container?.querySelector("svg")
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg)
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")
      const img = new Image()
      img.onload = () => {
        canvas.width = img.width
        canvas.height = img.height
        if (ctx) {
          ctx.fillStyle = "white"
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          const pngFile = canvas.toDataURL("image/png")
          const downloadLink = document.createElement("a")
          downloadLink.download = `${siteId || "marketplace"}-qr.png`
          downloadLink.href = pngFile
          downloadLink.click()
        }
      }
      img.src = "data:image/svg+xml;base64," + btoa(svgData)
    }
  }

  useEffect(() => {
    if (siteId) {
      listCatalogCategories(siteId).then(res => {
        if (res.data) setCategories(res.data)
      })
      listCatalogItems({ siteId, pageSize: 1000 }).then(res => {
        if (res.data) setItems(res.data)
      })
    }
  }, [siteId])

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
      form.reset(formData)
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

  const onDropImage = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
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
    }
  }, [form])

  const { getRootProps: getHeroRootProps, getInputProps: getHeroInputProps, isDragActive: isHeroDragActive } = useDropzone({
    onDrop: onDropImage,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp"]
    },
    disabled: isUploadingImage,
    maxFiles: 1
  })

  if (!active) return null

  return (
    <div className="space-y-6">
      {/* Marketplace URL & QR Code */}
      <SectionCard id="shop-share">
        <SectionCardHeader>
          <SectionCardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5 text-gray-500" />
            Share & Promote
          </SectionCardTitle>
          <p className="text-sm text-gray-500 mt-1">Share your marketplace link and QR code.</p>
        </SectionCardHeader>
        <SectionCardContent>
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="flex flex-col items-center gap-4 p-4 border rounded-xl bg-white">
              <div id="marketplace-qr-code-container" className="p-2 bg-white rounded-lg">
                <QRCode
                  value={siteUrl}
                  size={150}
                  level="M"
                />
              </div>
              <Button variant="outline" size="sm" type="button" onClick={handleDownloadQR} className="w-full gap-2">
                <Download className="h-4 w-4" />
                Download QR
              </Button>
            </div>
            <div className="flex-1 space-y-4 pt-2">
              <div>
                <FormLabel>Marketplace URL</FormLabel>
                <div className="flex gap-2 mt-1.5">
                  <Input value={siteUrl} readOnly className="bg-gray-50" />
                  <Button variant="outline" type="button" onClick={handleCopyUrl} className="shrink-0 gap-2">
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Use this link in your social media, campaigns, or directly share it with your customers.
                </p>
              </div>
            </div>
          </div>
        </SectionCardContent>
      </SectionCard>

      {/* Hero Section */}
      <SectionCard id="shop-hero">
        <SectionCardHeader>
          <SectionCardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-gray-500" />
            Storefront Hero
          </SectionCardTitle>
          <p className="text-sm text-gray-500 mt-1">Configure the main banner of your shop. Leave empty to hide.</p>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="shop.hero_cta_destination_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Call to Action Destination</FormLabel>
                  <FormControl>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      {...field}
                      value={field.value || "scroll"}
                    >
                      <option value="scroll">Scroll Down (Default)</option>
                      <option value="category">Category</option>
                      <option value="item">Item Detail</option>
                      <option value="url">External URL</option>
                    </select>
                  </FormControl>
                  <FormDescription>What happens when the user clicks the hero button.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("shop.hero_cta_destination_type") !== "scroll" && (
              <FormField
                control={form.control}
                name="shop.hero_cta_destination_value"
                render={({ field }) => {
                  const type = form.watch("shop.hero_cta_destination_type");
                  
                  if (type === "url") {
                    return (
                      <FormItem>
                        <FormLabel>Destination URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com" {...field} value={field.value || ""} />
                        </FormControl>
                        <FormDescription>The external URL to open.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )
                  }
                  
                  if (type === "category") {
                    return (
                      <FormItem>
                        <FormLabel>Select Category</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                            value={field.value || ""}
                          >
                            <option value="" disabled>Select a category...</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                          </select>
                        </FormControl>
                        <FormDescription>Select the category to filter by.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )
                  }
                  
                  if (type === "item") {
                    // Filter items to exclude variants and items not in marketplace
                    const filteredItems = items.filter(item => !item.parent_id && item.is_marketplace_listed);

                    return (
                      <FormItem>
                        <FormLabel>Select Item</FormLabel>
                        <FormControl>
                          <select
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                            value={field.value || ""}
                          >
                            <option value="" disabled>Select an item...</option>
                            {filteredItems.map(item => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </FormControl>
                        <FormDescription>Select the item to open.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )
                  }

                  return null;
                }}
              />
            )}
          </div>

          <FormField
            control={form.control}
            name="shop.hero_order_bar"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg p-3 shadow-sm border bg-background">
                <div className="space-y-0.5">
                  <FormLabel className="font-medium flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-violet-500" />
                    Hero order bar
                  </FormLabel>
                  <FormDescription className="text-xs">
                    Show pickup, delivery, dine-in, and schedule controls at the bottom of the hero. On desktop, the call-to-action sits in the same row.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value === true}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="shop.hero_subtitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hero Subtitle</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Discover our latest arrivals designed to elevate your everyday experience."
                    className="min-h-[72px]"
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
                <FormLabel>Hero Image</FormLabel>
                <FormControl>
                  <div>
                    <div
                      {...getHeroRootProps()}
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-4 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
                        isHeroDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:bg-gray-50",
                        isUploadingImage && "opacity-50 cursor-not-allowed hover:bg-transparent"
                      )}
                    >
                      <input {...getHeroInputProps()} />
                      
                      {field.value ? (
                        <div className="relative aspect-video w-full">
                          <img
                            src={field.value}
                            alt="Hero Image Preview"
                            className="object-cover rounded-lg w-full h-full"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              form.setValue("shop.hero_image_url", "", { shouldDirty: true, shouldValidate: true })
                            }}
                            className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-sm flex items-center justify-center"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <ImageIcon className="h-10 w-10 text-gray-400" />
                          <div className="text-center">
                            <p className="text-sm font-medium text-gray-600">
                              {isUploadingImage ? "Uploading..." : "Drag an image or click to select"}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              PNG, JPG, or GIF (max. 4MB)
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </FormControl>
                <FormDescription>Optional background image for the hero section.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" size="sm" 
            type="button"
            onClick={() => handleSave('shop-hero')}
            disabled={savingCard === 'shop-hero' || !form.formState.isDirty}
          >
            {savingCard === 'shop-hero' ? "Saving..." : "Save"}
          </Button>
        </SectionCardFooter>
      </SectionCard>

      {/* Trust & Shipping */}
      <SectionCard id="shop-trust">
        <SectionCardHeader>
          <SectionCardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-gray-500" />
            Trust & Policies
          </SectionCardTitle>
          <p className="text-sm text-gray-500 mt-1">Configure shipping thresholds and trust signals to boost conversions.</p>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
          
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
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" size="sm" 
            type="button"
            onClick={() => handleSave('shop-trust')}
            disabled={savingCard === 'shop-trust' || !form.formState.isDirty}
          >
            {savingCard === 'shop-trust' ? "Saving..." : "Save"}
          </Button>
        </SectionCardFooter>
      </SectionCard>

      {/* Payment & Delivery Policy */}
      <SectionCard id="shop-payments">
        <SectionCardHeader>
          <SectionCardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-gray-500" />
            Payment & Delivery Policy
          </SectionCardTitle>
          <p className="text-sm text-gray-500 mt-1">Configure default payment methods and delivery options for your marketplace items. Products can still override these settings.</p>
        </SectionCardHeader>
        <SectionCardContent className="space-y-4">
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
        </SectionCardContent>
        <SectionCardFooter>
          <Button variant="outline" size="sm" 
            type="button"
            onClick={() => handleSave('shop-payments')}
            disabled={savingCard === 'shop-payments' || !form.formState.isDirty}
          >
            {savingCard === 'shop-payments' ? "Saving..." : "Save"}
          </Button>
        </SectionCardFooter>
      </SectionCard>
    </div>
  )
}