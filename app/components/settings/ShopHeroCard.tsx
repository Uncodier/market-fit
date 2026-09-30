"use client"

import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"

import { cn } from "@/lib/utils"
import { SectionCard, SectionCardHeader, SectionCardTitle, SectionCardContent, SectionCardFooter } from "@/app/components/ui/section-card"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { Store, Image as ImageIcon, X, Calendar } from "../ui/icons"

import type { useShopSection } from "./use-shop-section"

export function ShopHeroCard({ form, savingCard, isUploadingImage, categories, items, handleSave, getHeroRootProps, getHeroInputProps, isHeroDragActive }: ReturnType<typeof useShopSection>) {
 return (      <SectionCard id="shop-hero">
        <SectionCardHeader>
          <SectionCardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-muted-foreground" />
            Storefront Hero
          </SectionCardTitle>
          <p className="text-sm text-muted-foreground mt-1">Configure the main banner of your shop. Leave empty to hide.</p>
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

                  return <></>;
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
                        isHeroDragActive ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50",
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
                          <ImageIcon className="h-10 w-10 text-muted-foreground" />
                          <div className="text-center">
                            <p className="text-sm font-medium text-foreground">
                              {isUploadingImage ? "Uploading..." : "Drag an image or click to select"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
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
)
}
