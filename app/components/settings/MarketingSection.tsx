"use client"

import { useFormContext } from "react-hook-form"
import { useState } from "react"
import { type SiteFormValues, type MarketingChannel } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, Tag } from "../ui/icons"

interface MarketingSectionProps {
  active: boolean
}

export function MarketingSection({ active }: MarketingSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [channelsList, setChannelsList] = useState<MarketingChannel[]>(
    form.getValues("marketing_channels") || []
  )
  const [productsList, setProductsList] = useState<string[]>(
    form.getValues("products") ?? []
  )
  const [servicesList, setServicesList] = useState<string[]>(
    form.getValues("services") ?? []
  )

  // Add channel
  const addChannel = () => {
    const newChannels = [...channelsList, { name: "" }]
    setChannelsList(newChannels)
    form.setValue("marketing_channels", newChannels)
  }

  // Remove channel
  const removeChannel = (index: number) => {
    const newChannels = channelsList.filter((_, i) => i !== index)
    setChannelsList(newChannels)
    form.setValue("marketing_channels", newChannels)
  }

  // Add product
  const addProduct = () => {
    const newProducts = [...(productsList || [])]
    newProducts.push("")
    setProductsList(newProducts)
    form.setValue("products", newProducts)
  }

  // Remove product
  const removeProduct = (index: number) => {
    if (!productsList) return
    const newProducts = productsList.filter((_, i) => i !== index)
    setProductsList(newProducts)
    form.setValue("products", newProducts)
  }

  // Add service
  const addService = () => {
    const newServices = [...(servicesList || [])]
    newServices.push("")
    setServicesList(newServices)
    form.setValue("services", newServices)
  }

  // Remove service
  const removeService = (index: number) => {
    if (!servicesList) return
    const newServices = servicesList.filter((_, i) => i !== index)
    setServicesList(newServices)
    form.setValue("services", newServices)
  }

  if (!active) return null

  return (
    <>
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Products & Services</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Add your company's products and services
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <div>
            <h3 className="text-base font-medium mb-4">Products</h3>
            {productsList && productsList.map((product, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <FormField
                  control={form.control}
                  name={`products.${index}`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          placeholder="Product name"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            if (productsList) {
                              const newProducts = [...productsList]
                              newProducts[index] = e.target.value
                              setProductsList(newProducts)
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => removeProduct(index)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="mt-2"
              type="button"
              onClick={addProduct}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </div>

          <div>
            <h3 className="text-base font-medium mb-4">Services</h3>
            {servicesList && servicesList.map((service, index) => (
              <div key={index} className="flex items-center gap-2 mb-2">
                <FormField
                  control={form.control}
                  name={`services.${index}`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          placeholder="Service name"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            if (servicesList) {
                              const newServices = [...servicesList]
                              newServices[index] = e.target.value
                              setServicesList(newServices)
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => removeService(index)}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              className="mt-2"
              type="button"
              onClick={addService}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Marketing Budget</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="marketing_budget.total"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Budget</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0.00"
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
                      placeholder="0.00"
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
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Marketing Channels</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Add your marketing channels and platforms
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          {channelsList.map((channel, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <FormField
                control={form.control}
                name={`marketing_channels.${index}.name`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <Input
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
          ))}
          <Button
            variant="outline"
            className="mt-2"
            type="button"
            onClick={addChannel}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Marketing Channel
          </Button>
        </CardContent>
      </Card>
    </>
  )
} 