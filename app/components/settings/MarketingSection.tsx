"use client"

import { useFormContext } from "react-hook-form"
import { useState, useEffect } from "react"
import { type SiteFormValues, type MarketingChannel, getFocusModeConfig } from "./form-schema"
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "../ui/form"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Button } from "../ui/button"
import { PlusCircle, Trash2, Tag, Link, Globe, AppWindow, ChevronDown, ChevronRight } from "../ui/icons"
import { Slider } from "../ui/slider"

interface MarketingSectionProps {
  active: boolean
}

export function MarketingSection({ active }: MarketingSectionProps) {
  const form = useFormContext<SiteFormValues>()
  const [channelsList, setChannelsList] = useState<MarketingChannel[]>(
    form.getValues("marketing_channels") || []
  )
  const [productsList, setProductsList] = useState<any[]>(
    form.getValues("products") ?? []
  )
  const [servicesList, setServicesList] = useState<any[]>(
    form.getValues("services") ?? []
  )
  const [resourceList, setResourceList] = useState<{key: string, url: string}[]>(
    form.getValues("resource_urls") || []
  )
  const [competitorList, setCompetitorList] = useState<{name?: string, url: string}[]>(
    form.getValues("competitors") || []
  )
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set())

  // Sync products and services when form values change
  useEffect(() => {
    const formProducts = form.getValues("products")
    const formServices = form.getValues("services")
    
    if (formProducts && Array.isArray(formProducts)) {
      setProductsList(formProducts)
    }
    
    if (formServices && Array.isArray(formServices)) {
      setServicesList(formServices)
    }
  }, [form.watch("products"), form.watch("services")])

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
    const newProduct = {
      name: "",
      description: "",
      cost: 0,
      lowest_sale_price: 0,
      target_sale_price: 0
    }
    const newProducts = [...(productsList || []), newProduct]
    setProductsList(newProducts)
    form.setValue("products", newProducts)
    
    // Expand the newly added item
    const newExpanded = new Set(expandedProducts)
    newExpanded.add(newProducts.length - 1)
    setExpandedProducts(newExpanded)
  }

  // Remove product
  const removeProduct = (index: number) => {
    if (!productsList) return
    const newProducts = productsList.filter((_, i) => i !== index)
    setProductsList(newProducts)
    form.setValue("products", newProducts)
  }

  // Update product
  const updateProduct = (index: number, field: string, value: any) => {
    const newProducts = [...productsList]
    newProducts[index][field] = value
    setProductsList(newProducts)
    form.setValue("products", newProducts)
  }

  // Add service
  const addService = () => {
    const newService = {
      name: "",
      description: "",
      cost: 0,
      lowest_sale_price: 0,
      target_sale_price: 0
    }
    const newServices = [...(servicesList || []), newService]
    setServicesList(newServices)
    form.setValue("services", newServices)
    
    // Expand the newly added item
    const newExpanded = new Set(expandedServices)
    newExpanded.add(newServices.length - 1)
    setExpandedServices(newExpanded)
  }

  // Remove service
  const removeService = (index: number) => {
    if (!servicesList) return
    const newServices = servicesList.filter((_, i) => i !== index)
    setServicesList(newServices)
    form.setValue("services", newServices)
  }

  // Update service
  const updateService = (index: number, field: string, value: any) => {
    const newServices = [...servicesList]
    newServices[index][field] = value
    setServicesList(newServices)
    form.setValue("services", newServices)
  }

  // Toggle expanded state for products
  const toggleProductExpanded = (index: number) => {
    const newExpanded = new Set(expandedProducts)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedProducts(newExpanded)
  }

  // Toggle expanded state for services
  const toggleServiceExpanded = (index: number) => {
    const newExpanded = new Set(expandedServices)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedServices(newExpanded)
  }

  // Add resource entry
  const addResource = () => {
    const newResources = [...resourceList, { key: "", url: "" }]
    setResourceList(newResources)
    form.setValue("resource_urls", newResources)
  }

  // Remove resource entry
  const removeResource = (index: number) => {
    const newResources = resourceList.filter((_, i) => i !== index)
    setResourceList(newResources)
    form.setValue("resource_urls", newResources)
  }

  // Add competitor entry
  const addCompetitor = () => {
    const newCompetitors = [...competitorList, { name: "", url: "" }]
    setCompetitorList(newCompetitors)
    form.setValue("competitors", newCompetitors as any)
  }

  // Remove competitor entry
  const removeCompetitor = (index: number) => {
    const newCompetitors = competitorList.filter((_, i) => i !== index)
    setCompetitorList(newCompetitors)
    form.setValue("competitors", newCompetitors as any)
  }

  if (!active) return null

  const focusConfig = getFocusModeConfig(form.watch("focusMode"))

  return (
    <>
      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">AI Focus Mode</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Adjust the focus balance between sales conversion and user growth
          </p>
        </CardHeader>
        <CardContent className="px-8 pb-8">
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
                            <div className="rounded-full h-1.5 w-1.5 mt-1.5 mr-2 bg-primary" />
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
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Marketing Budget (in USD)</CardTitle>
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
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Products</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Add your company's products with pricing information
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          {productsList && productsList.map((product, index) => {
            const isExpanded = expandedProducts.has(index)
            
            return (
              <div key={index} className="border border-border rounded-lg overflow-hidden">
                <div className="p-4 bg-muted/30">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => toggleProductExpanded(index)}
                      className="p-1 hover:bg-muted/50 rounded transition-colors h-10 w-10 flex items-center justify-center"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    
                    <div className="flex-1">
                      <FormField
                        control={form.control}
                        name={`products.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Product name"
                                value={product.name || ""}
                                onChange={(e) => {
                                  field.onChange(e)
                                  updateProduct(index, 'name', e.target.value)
                                }}
                                className="bg-background"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={() => removeProduct(index)}
                      className="h-10 w-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6 space-y-4 border-t border-border">
                    <FormField
                      control={form.control}
                      name={`products.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe this product..."
                              value={product.description || ""}
                              onChange={(e) => {
                                field.onChange(e)
                                updateProduct(index, 'description', e.target.value)
                              }}
                              className="min-h-[100px]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`products.${index}.cost`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost (USD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={product.cost || 0}
                                onChange={(e) => {
                                  field.onChange(Number(e.target.value))
                                  updateProduct(index, 'cost', Number(e.target.value))
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`products.${index}.lowest_sale_price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lowest Sale Price (USD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={product.lowest_sale_price || 0}
                                onChange={(e) => {
                                  field.onChange(Number(e.target.value))
                                  updateProduct(index, 'lowest_sale_price', Number(e.target.value))
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`products.${index}.target_sale_price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Sale Price (USD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={product.target_sale_price || 0}
                                onChange={(e) => {
                                  field.onChange(Number(e.target.value))
                                  updateProduct(index, 'target_sale_price', Number(e.target.value))
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <Button
            variant="outline"
            className="mt-2 w-full h-12"
            type="button"
            onClick={addProduct}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Services</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Add your company's services with pricing information
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          {servicesList && servicesList.map((service, index) => {
            const isExpanded = expandedServices.has(index)
            
            return (
              <div key={index} className="border border-border rounded-lg overflow-hidden">
                <div className="p-4 bg-muted/30">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => toggleServiceExpanded(index)}
                      className="p-1 hover:bg-muted/50 rounded transition-colors h-10 w-10 flex items-center justify-center"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    
                    <div className="flex-1">
                      <FormField
                        control={form.control}
                        name={`services.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder="Service name"
                                value={service.name || ""}
                                onChange={(e) => {
                                  field.onChange(e)
                                  updateService(index, 'name', e.target.value)
                                }}
                                className="bg-background"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      type="button"
                      onClick={() => removeService(index)}
                      className="h-10 w-10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-6 space-y-4 border-t border-border">
                    <FormField
                      control={form.control}
                      name={`services.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe this service..."
                              value={service.description || ""}
                              onChange={(e) => {
                                field.onChange(e)
                                updateService(index, 'description', e.target.value)
                              }}
                              className="min-h-[100px]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`services.${index}.cost`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost (USD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={service.cost || 0}
                                onChange={(e) => {
                                  field.onChange(Number(e.target.value))
                                  updateService(index, 'cost', Number(e.target.value))
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`services.${index}.lowest_sale_price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lowest Sale Price (USD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={service.lowest_sale_price || 0}
                                onChange={(e) => {
                                  field.onChange(Number(e.target.value))
                                  updateService(index, 'lowest_sale_price', Number(e.target.value))
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`services.${index}.target_sale_price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Target Sale Price (USD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="0.00"
                                value={service.target_sale_price || 0}
                                onChange={(e) => {
                                  field.onChange(Number(e.target.value))
                                  updateService(index, 'target_sale_price', Number(e.target.value))
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <Button
            variant="outline"
            className="mt-2 w-full h-12"
            type="button"
            onClick={addService}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Service
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Competitors</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Add your main competitors for market analysis
          </p>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          {competitorList.map((competitor, index) => (
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
          ))}
          <Button
            variant="outline"
            className="mt-2 w-full h-12"
            type="button"
            onClick={addCompetitor}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Competitor
          </Button>
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
          ))}
          <Button
            variant="outline"
            className="mt-2 w-full h-12"
            type="button"
            onClick={addChannel}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Marketing Channel
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="px-8 py-6">
          <CardTitle className="text-xl font-semibold">Web Resources</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 px-8 pb-8">
          {resourceList.map((resource, index) => (
            <div key={index} className="flex items-center space-x-2">
              <FormField
                control={form.control}
                name={`resource_urls.${index}.key`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-12 h-12 text-base"
                          placeholder="Resource name"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            const newResources = [...resourceList]
                            newResources[index].key = e.target.value
                            setResourceList(newResources)
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
                name={`resource_urls.${index}.url`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormControl>
                      <div className="relative">
                        <Link className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-12 h-12 text-base"
                          placeholder="https://example.com/resource"
                          {...field}
                          onChange={(e) => {
                            field.onChange(e)
                            const newResources = [...resourceList]
                            newResources[index].url = e.target.value
                            setResourceList(newResources)
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
                onClick={() => removeResource(index)}
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            className="mt-2 w-full h-12"
            type="button"
            onClick={addResource}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Resource
          </Button>
        </CardContent>
      </Card>
    </>
  )
} 