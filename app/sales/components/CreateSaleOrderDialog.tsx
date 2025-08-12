"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Textarea } from "@/app/components/ui/textarea";
import { createSaleOrder } from "@/app/sales/actions";
import { Plus, Trash2 } from "@/app/components/ui/icons";
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut";
import { Sale } from "@/app/types";

interface CreateSaleOrderDialogProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateSaleOrderDialog({ sale, open, onOpenChange, onSuccess }: CreateSaleOrderDialogProps) {
  const [loading, setLoading] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [items, setItems] = useState([{
    id: `item-${Date.now()}`,
    name: "",
    description: "",
    quantity: 1,
    unitPrice: 0,
    subtotal: 0
  }]);
  const [notes, setNotes] = useState("");
  
  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  
  const taxTotal = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.max(0, subtotal + taxTotal - discountAmount);

  // Generate order number
  const generateOrderNumber = () => {
    const prefix = "ORD";
    const date = new Date();
    const year = date.getFullYear().toString().slice(2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    
    return `${prefix}-${year}${month}${day}-${random}`;
  };

  // Reset form
  const resetForm = () => {
    setOrderNumber(generateOrderNumber());
    setItems([{
      id: `item-${Date.now()}`,
      name: "",
      description: "",
      quantity: 1,
      unitPrice: 0,
      subtotal: 0
    }]);
    setNotes("");
    setTaxRate(0);
    setDiscountAmount(0);
  };

  // Handle item changes
  const handleItemChange = (id: string, field: string, value: any) => {
    setItems(prevItems => {
      return prevItems.map(item => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };
          
          // Recalculate subtotal if quantity or unitPrice changed
          if (field === 'quantity' || field === 'unitPrice') {
            updatedItem.subtotal = updatedItem.quantity * updatedItem.unitPrice;
          }
          
          return updatedItem;
        }
        return item;
      });
    });
  };

  // Add new item
  const handleAddItem = () => {
    setItems(prevItems => [
      ...prevItems,
      {
        id: `item-${Date.now()}`,
        name: "",
        description: "",
        quantity: 1,
        unitPrice: 0,
        subtotal: 0
      }
    ]);
  };

  // Remove item
  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) {
      toast.error("Cannot remove all items. At least one item is required.");
      return;
    }
    
    setItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sale) return;
    
    // Validate form
    if (!orderNumber) {
      toast.error("Order number is required");
      return;
    }
    
    if (items.length === 0) {
      toast.error("At least one item is required");
      return;
    }
    
    // Check if all items have names and valid quantities
    const invalidItems = items.filter(item => !item.name || item.quantity <= 0);
    if (invalidItems.length > 0) {
      toast.error("All items must have a name and a quantity greater than 0");
      return;
    }
    
    setLoading(true);
    
    try {
      // Format items for submission
      const formattedItems = items.map(({ id, ...item }) => item);
      
      const result = await createSaleOrder({
        saleId: sale.id,
        orderNumber,
        items: formattedItems,
        subtotal,
        taxTotal,
        discountTotal: discountAmount,
        total,
        notes: notes.trim() || undefined,
        siteId: sale.siteId
      });
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Order created successfully");
        resetForm();
        onOpenChange(false);
        onSuccess();
      }
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Failed to create order");
    } finally {
      setLoading(false);
    }
  };
  
  // Set initial order number when dialog opens
  useEffect(() => {
    if (open) {
      setOrderNumber(generateOrderNumber());
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-120px)] pr-4 -mr-4">
          <DialogHeader>
            <DialogTitle>Create Order</DialogTitle>
            <DialogDescription>
              Add a new order for this sale. Fill in the order details below.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Order Number */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="orderNumber" className="text-right">
                Order Number
              </Label>
              <div className="col-span-3">
                <Input
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
            </div>
            
            {/* Item List */}
            <div className="mt-2">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium">Items</h3>
                <Button 
                  type="button" 
                  size="sm" 
                  variant="outline" 
                  onClick={handleAddItem}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              <div className="border rounded-md divide-y">
                {items.map((item, index) => (
                  <div key={item.id} className="p-3">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium">Item {index + 1}</h4>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveItem(item.id)}
                        className="h-8 w-8 p-0 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="grid gap-3">
                      <div className="grid grid-cols-4 items-center gap-2">
                        <Label htmlFor={`name-${item.id}`} className="text-right text-xs">
                          Name
                        </Label>
                        <div className="col-span-3">
                          <Input
                            id={`name-${item.id}`}
                            value={item.name}
                            onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                            required
                            className="h-12"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-4 items-center gap-2">
                        <Label htmlFor={`description-${item.id}`} className="text-right text-xs">
                          Description
                        </Label>
                        <div className="col-span-3">
                          <Input
                            id={`description-${item.id}`}
                            value={item.description}
                            onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                            className="h-12"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid grid-cols-2 items-center gap-2">
                          <Label htmlFor={`quantity-${item.id}`} className="text-right text-xs">
                            Quantity
                          </Label>
                          <Input
                            id={`quantity-${item.id}`}
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                            required
                            className="h-12"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 items-center gap-2">
                          <Label htmlFor={`price-${item.id}`} className="text-right text-xs">
                            Price
                          </Label>
                          <Input
                            id={`price-${item.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            required
                            className="h-12"
                          />
                        </div>
                      </div>
                      
                      <div className="text-right text-sm font-medium">
                        Subtotal: {formatCurrency(item.subtotal)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Price Summary */}
            <div className="mt-3 space-y-2 pb-2 pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="taxRate" className="text-right text-sm">
                  Tax Rate (%)
                </Label>
                <div className="col-span-1">
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate * 100}
                    onChange={(e) => setTaxRate(parseFloat(e.target.value) / 100 || 0)}
                    className="h-12"
                  />
                </div>
                <div className="col-span-2 flex justify-between">
                  <span className="text-muted-foreground">Tax:</span>
                  <span>{formatCurrency(taxTotal)}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="discount" className="text-right text-sm">
                  Discount
                </Label>
                <div className="col-span-1">
                  <Input
                    id="discount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                    className="h-12"
                  />
                </div>
                <div className="col-span-2 flex justify-between">
                  <span className="text-muted-foreground">Discount:</span>
                  <span className="text-green-600">-{formatCurrency(discountAmount)}</span>
                </div>
              </div>
              
              <div className="flex justify-between font-semibold text-lg py-2 border-t">
                <span>Total:</span>
                <span className="text-primary">{formatCurrency(total)}</span>
              </div>
            </div>
            
            {/* Notes */}
            <div className="grid gap-2 mt-2">
              <Label htmlFor="notes">Order Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes or special instructions for this order..."
                className="h-20 min-h-[100px]"
              />
            </div>
          </div>
          
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-pulse bg-muted rounded" />
                  <span>Creating</span>
                </div>
              ) : "Create Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 