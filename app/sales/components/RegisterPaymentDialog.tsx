"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Textarea } from "@/app/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { updateSale } from "@/app/sales/actions";
import { CreditCard } from "@/app/components/ui/icons";
import { formatCurrency } from "@/app/components/dashboard/campaign-revenue-donut";
import { Sale } from "@/app/types";
import { format } from "date-fns";

interface RegisterPaymentDialogProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS = [
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "paypal", label: "PayPal" },
  { value: "stripe", label: "Stripe" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "wire_transfer", label: "Wire Transfer" },
];

export function RegisterPaymentDialog({ sale, open, onOpenChange, onSuccess }: RegisterPaymentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("credit_card");
  const [notes, setNotes] = useState("");
  
  // Reset form based on sale when dialog opens
  const resetForm = () => {
    if (sale) {
      setPaymentAmount(sale.amount_due.toString());
      setPaymentMethod(sale.paymentMethod || "credit_card");
      setNotes("");
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!sale) return;
    
    // Validate form
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    
    if (amount > sale.amount_due) {
      toast.error("Payment amount cannot exceed the amount due");
      return;
    }
    
    setLoading(true);
    
    try {
      // Calculate the new amount due after payment
      const newAmountDue = Math.max(0, sale.amount_due - amount);
      
      // Create payment record
      const payment = {
        id: `payment-${Date.now()}`,
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss"),
        amount,
        method: paymentMethod,
        notes: notes.trim() || undefined
      };
      
      // Get existing payments or create a new array
      const existingPayments = sale.payments || [];
      
      // Update the sale
      const updatedSale: Sale = {
        ...sale,
        amount_due: newAmountDue,
        paymentMethod,
        payments: [...existingPayments, payment]
      };
      
      const result = await updateSale(sale.siteId, updatedSale);
      
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Payment registered successfully");
        onOpenChange(false);
        onSuccess();
      }
    } catch (error) {
      console.error("Error registering payment:", error);
      toast.error("Failed to register payment");
    } finally {
      setLoading(false);
    }
  };
  
  // Reset form when dialog opens
  if (open && sale && paymentAmount === "") {
    resetForm();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden">
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-120px)] pr-4 -mr-4">
          <DialogHeader>
            <DialogTitle>Register Payment</DialogTitle>
            <DialogDescription>
              Register a payment for this sale. The amount due will be reduced accordingly.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Payment Details */}
            <div className="bg-muted/50 dark:bg-muted/10 p-4 rounded-md mb-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground dark:text-muted-foreground">Invoice</div>
                  <div className="font-medium">{sale?.title || "N/A"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground dark:text-muted-foreground">Date</div>
                  <div className="font-medium">{sale ? format(new Date(), "MMM d, yyyy") : "N/A"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <div className="text-sm text-muted-foreground dark:text-muted-foreground">Total Amount</div>
                  <div className="font-medium">{sale ? formatCurrency(sale.amount) : "$0.00"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground dark:text-muted-foreground">Amount Due</div>
                  <div className="font-medium text-primary">{sale ? formatCurrency(sale.amount_due) : "$0.00"}</div>
                </div>
              </div>
            </div>
            
            {/* Payment Amount */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paymentAmount" className="text-right">
                Payment Amount
              </Label>
              <div className="col-span-3">
                <Input
                  id="paymentAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={sale?.amount_due || 0}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  className="h-12"
                />
              </div>
            </div>
            
            {/* Payment Method */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="paymentMethod" className="text-right">
                Payment Method
              </Label>
              <div className="col-span-3">
                <Select
                  value={paymentMethod}
                  onValueChange={setPaymentMethod}
                >
                  <SelectTrigger id="paymentMethod" className="h-12">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Notes */}
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="notes" className="text-right">
                Notes
              </Label>
              <div className="col-span-3">
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any payment notes..."
                  className="h-24 min-h-[100px]"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Processing..." : "Register Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 