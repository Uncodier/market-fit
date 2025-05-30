"use client"

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../../ui/form"
import { Input } from "../../ui/input"
import { Textarea } from "../../ui/textarea"
import { Button } from "../../ui/button"
import { ChevronDown, ChevronRight, PlusCircle, Trash2 } from "../../ui/icons"

interface ProductsServicesStepProps {
  form: any
  addProduct: () => void
  removeProduct: (index: number) => void
  addService: () => void
  removeService: (index: number) => void
  expandedProducts: Set<number>
  expandedServices: Set<number>
  toggleProductExpanded: (index: number) => void
  toggleServiceExpanded: (index: number) => void
}

export function ProductsServicesStep({ 
  form, 
  addProduct, 
  removeProduct, 
  addService, 
  removeService,
  expandedProducts,
  expandedServices,
  toggleProductExpanded,
  toggleServiceExpanded
}: ProductsServicesStepProps) {
  return (
    <div className="space-y-6">
      <div className="bg-muted/30 rounded-lg p-4 mb-6">
        <p className="text-sm text-muted-foreground">
          <strong>💡 Why this helps:</strong> Products and services information allows our AI to provide better insights and recommendations for your business offerings.
        </p>
      </div>

      {/* Products Section */}
      <div className="space-y-4">
        <FormLabel className="text-base font-medium">Products (Optional)</FormLabel>
        <div className="space-y-3">
          {form.watch("products")?.map((product: any, index: number) => {
            const isExpanded = expandedProducts.has(index)
            
            return (
              <div key={index} className="border border-border rounded-lg overflow-hidden">
                <div className="p-4 bg-muted/5 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleProductExpanded(index)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <FormField
                      control={form.control}
                      name={`products.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input 
                              placeholder="Product name"
                              className="bg-background"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeProduct(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                {isExpanded && (
                  <div className="p-4 border-t space-y-4">
                    <FormField
                      control={form.control}
                      name={`products.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe this product..."
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`products.${index}.cost`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                            <FormLabel>Lowest Sale Price ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                            <FormLabel>Target Sale Price ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
            type="button"
            variant="outline"
            className="w-full"
            onClick={addProduct}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Services Section */}
      <div className="space-y-4">
        <FormLabel className="text-base font-medium">Services (Optional)</FormLabel>
        <div className="space-y-3">
          {form.watch("services")?.map((service: any, index: number) => {
            const isExpanded = expandedServices.has(index)
            
            return (
              <div key={index} className="border border-border rounded-lg overflow-hidden">
                <div className="p-4 bg-muted/5 flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleServiceExpanded(index)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    <FormField
                      control={form.control}
                      name={`services.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input 
                              placeholder="Service name"
                              className="bg-background"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeService(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                {isExpanded && (
                  <div className="p-4 border-t space-y-4">
                    <FormField
                      control={form.control}
                      name={`services.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe this service..."
                              className="resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name={`services.${index}.cost`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cost ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                            <FormLabel>Lowest Sale Price ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                            <FormLabel>Target Sale Price ($)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                placeholder="0"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
            type="button"
            variant="outline"
            className="w-full"
            onClick={addService}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Service
          </Button>
        </div>
      </div>
    </div>
  )
} 