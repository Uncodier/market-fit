import React, { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { SkeletonCard } from "@/app/components/ui/skeleton-card"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Badge } from "@/app/components/ui/badge"
import { useSite } from "@/app/context/SiteContext"
import { getCampaignSales, createSale, updateSale, deleteSale } from "@/app/campaigns/actions/sales"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/app/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/app/components/ui/dropdown-menu"
import { Pencil, Trash2, PlusCircle, BarChart } from "@/app/components/ui/icons"

// Format currency utility
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
};

// Sale status badge function
function getSaleStatusBadge(status: string) {
  if (!status) {
    return (
      <div className="inline-flex items-center rounded-full bg-gray-500 px-2.5 py-0.5 text-xs font-semibold text-white">
        Unknown
      </div>
    );
  }
  
  // Normalize status to lowercase
  const normalizedStatus = status.toLowerCase().trim();
  
  switch (normalizedStatus) {
    case "completed":
      return (
        <div className="inline-flex items-center rounded-full bg-green-500 px-2.5 py-0.5 text-xs font-semibold text-white">
          Completed
        </div>
      );
    case "pending":
      return (
        <div className="inline-flex items-center rounded-full bg-yellow-500 px-2.5 py-0.5 text-xs font-semibold text-white">
          Pending
        </div>
      );
    case "cancelled":
      return (
        <div className="inline-flex items-center rounded-full bg-red-500 px-2.5 py-0.5 text-xs font-semibold text-white">
          Cancelled
        </div>
      );
    case "refunded":
      return (
        <div className="inline-flex items-center rounded-full bg-gray-500 px-2.5 py-0.5 text-xs font-semibold text-white">
          Refunded
        </div>
      );
    default:
      return (
        <div className="inline-flex items-center rounded-full bg-gray-500 px-2.5 py-0.5 text-xs font-semibold text-white">
          {status}
        </div>
      );
  }
}

export function CampaignSales({ campaign }: { campaign: any }) {
  const [sales, setSales] = useState<any[]>([])
  const [loadingSales, setLoadingSales] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const { currentSite } = useSite()
  const params = useParams()

  // New sale form state
  const [newSale, setNewSale] = useState({
    title: "",
    amount: "",
    status: "completed",
    leadId: null,
    campaignId: campaign.id,
    segmentId: null,
    productName: "",
    saleDate: new Date().toISOString().split('T')[0],
    paymentMethod: "credit_card",
    source: "online",
    notes: ""
  })
  
  // Add states for edit and delete operations
  const [editingSale, setEditingSale] = useState<any | null>(null)
  const [isEditingSale, setIsEditingSale] = useState(false)
  const [isDeletingSale, setIsDeletingSale] = useState(false)
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null)

  // Load sales on component mount
  useEffect(() => {
    if (campaign.id) {
      loadSales()
    }
  }, [campaign.id])

  // Function to load sales
  const loadSales = async () => {
    try {
      setLoadingSales(true)
      const { data, error } = await getCampaignSales(campaign.id)
      if (error) {
        console.error("Error loading sales:", error)
        toast.error("Failed to load sales data")
      } else {
        setSales(data || [])
      }
    } catch (error) {
      console.error("Error in loadSales:", error)
      toast.error("An error occurred while loading sales")
    } finally {
      setLoadingSales(false)
    }
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setNewSale(prev => ({ ...prev, [name]: value }))
  }

  // Handle select change
  const handleSelectChange = (name: string, value: string) => {
    setNewSale(prev => ({ ...prev, [name]: value }))
  }

  // Handle create sale
  const handleCreateSale = async () => {
    if (!newSale.title || !newSale.amount || !newSale.saleDate) {
      toast.error("Please fill in all required fields")
      return
    }

    if (!currentSite) {
      toast.error("Site information is required")
      return
    }

    try {
      // Ensure status has a valid value
      const status = newSale.status || "completed";

      const saleData = {
        title: newSale.title,
        amount: parseFloat(newSale.amount),
        status: status as 'pending' | 'completed' | 'cancelled' | 'refunded',
        leadId: newSale.leadId,
        campaignId: campaign.id,
        segmentId: newSale.segmentId,
        productName: newSale.productName,
        saleDate: newSale.saleDate,
        paymentMethod: newSale.paymentMethod,
        source: newSale.source as 'retail' | 'online',
        notes: newSale.notes,
        siteId: currentSite.id,
        userId: currentSite.user_id
      }

      const { data, error } = await createSale(saleData)

      if (error) {
        toast.error(`Failed to create sale: ${error}`)
        return
      }

      // Reset form and close modal
      setNewSale({
        title: "",
        amount: "",
        status: "completed",
        leadId: null,
        campaignId: campaign.id,
        segmentId: null,
        productName: "",
        saleDate: new Date().toISOString().split('T')[0],
        paymentMethod: "credit_card",
        source: "online",
        notes: ""
      })
      setIsCreating(false)

      // Reload sales
      loadSales()

      toast.success("Sale created successfully")
    } catch (error) {
      console.error("Error creating sale:", error)
      toast.error("An error occurred while creating the sale")
    }
  }

  // Add handlers for edit and delete
  const handleEditSale = (sale: any) => {
    setEditingSale({
      id: sale.id,
      title: sale.title,
      amount: sale.amount.toString(),
      status: sale.status || "completed",
      productName: sale.productName || "",
      saleDate: sale.saleDate,
      paymentMethod: sale.paymentMethod || "credit_card",
      source: sale.source || "online"
    });
    setIsEditingSale(true);
  };
  
  const handleEditSaleChange = (name: string, value: string) => {
    setEditingSale((prev: any) => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleUpdateSale = async () => {
    if (!editingSale || !editingSale.id) {
      toast.error("Sale data is missing");
      return;
    }
    
    if (!editingSale.amount || parseFloat(editingSale.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    // Ensure status has a valid value
    const status = editingSale.status || "completed";
    
    try {
      const result = await updateSale(editingSale.id, {
        title: editingSale.title,
        amount: parseFloat(editingSale.amount),
        status: status as 'pending' | 'completed' | 'cancelled' | 'refunded',
        productName: editingSale.productName,
        saleDate: editingSale.saleDate,
        paymentMethod: editingSale.paymentMethod,
        source: editingSale.source as 'retail' | 'online'
      });
      
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      toast.success("Sale updated successfully");
      setIsEditingSale(false);
      
      // Reload sales to reflect the update
      loadSales();
    } catch (error) {
      console.error("Error updating sale:", error);
      toast.error("Failed to update sale");
    }
  };
  
  const handleDeleteSale = async () => {
    if (!saleToDelete) {
      toast.error("Sale ID is missing");
      return;
    }
    
    try {
      const result = await deleteSale(saleToDelete);
      
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      toast.success("Sale deleted successfully");
      setIsDeletingSale(false);
      setSaleToDelete(null);
      
      // Reload sales to reflect the deletion
      loadSales();
    } catch (error) {
      console.error("Error deleting sale:", error);
      toast.error("Failed to delete sale");
    }
  };
  
  const handleOpenDeleteDialog = (id: string) => {
    setSaleToDelete(id);
    setIsDeletingSale(true);
  };

  // Calculate total sales amount
  const calculateTotalSales = () => {
    return sales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Sales & Conversions</h3>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Sale
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="sm:max-w-[425px]">
              <AlertDialogHeader>
                <AlertDialogTitle>Add New Sale</AlertDialogTitle>
                <AlertDialogDescription>
                  Enter the details of the new sale for this campaign.
                </AlertDialogDescription>
              </AlertDialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title*</Label>
                  <Input
                    id="title"
                    name="title"
                    placeholder="Sale title"
                    value={newSale.title}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount ($)*</Label>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    placeholder="0"
                    value={newSale.amount}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="saleDate">Sale Date*</Label>
                  <Input
                    id="saleDate"
                    name="saleDate"
                    type="date"
                    value={newSale.saleDate}
                    onChange={handleInputChange}
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={newSale.status}
                    onValueChange={(value) => handleSelectChange("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="productName">Product Name</Label>
                  <Input
                    id="productName"
                    name="productName"
                    placeholder="Product or service name"
                    value={newSale.productName || ""}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Payment Method</Label>
                  <Select
                    value={newSale.paymentMethod}
                    onValueChange={(value) => handleSelectChange("paymentMethod", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="source">Source</Label>
                  <Select
                    value={newSale.source}
                    onValueChange={(value) => handleSelectChange("source", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Input
                    id="notes"
                    name="notes"
                    placeholder="Any additional notes"
                    value={newSale.notes || ""}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleCreateSale}>
                  Create Sale
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        
        {loadingSales ? (
          <SkeletonCard 
            className="border-none shadow-none" 
            showHeader={false}
            contentClassName="space-y-3"
            contentHeight="h-[200px]"
          />
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-3 font-medium text-sm">Title</th>
                    <th className="text-left p-3 font-medium text-sm">Amount</th>
                    <th className="text-left p-3 font-medium text-sm">Date</th>
                    <th className="text-left p-3 font-medium text-sm">Status</th>
                    <th className="text-left p-3 font-medium text-sm">Payment</th>
                    <th className="text-left p-3 font-medium text-sm">Source</th>
                    <th className="text-right p-3 font-medium text-sm w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center">
                        <EmptyCard
                          icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
                          title="No sales yet"
                          description="No sales recorded for this campaign yet."
                          className="border-none shadow-none py-10" 
                          contentClassName="flex flex-col items-center justify-center"
                        />
                      </td>
                    </tr>
                  ) : (
                    <>
                      {sales.map((sale) => (
                        <tr key={sale.id} className="hover:bg-muted/20">
                          <td className="p-3">
                            <div className="font-medium">{sale.title}</div>
                            {sale.productName && <div className="text-xs text-muted-foreground">{sale.productName}</div>}
                          </td>
                          <td className="p-3">
                            {formatCurrency(sale.amount)}
                          </td>
                          <td className="p-3">
                            {new Date(sale.saleDate).toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            {getSaleStatusBadge(sale.status || "unknown")}
                          </td>
                          <td className="p-3 capitalize">
                            {sale.paymentMethod?.replace('_', ' ')}
                          </td>
                          <td className="p-3 capitalize">
                            {sale.source || "online"}
                          </td>
                          <td className="p-3 text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <span className="sr-only">Open menu</span>
                                  <span className="text-base leading-none">⋮</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditSale(sale)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleOpenDeleteDialog(sale.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/20 font-medium">
                        <td className="p-3">Total Sales</td>
                        <td className="p-3">{formatCurrency(calculateTotalSales())}</td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardContent>
      
      {/* Edit Sale Dialog */}
      <AlertDialog open={isEditingSale} onOpenChange={setIsEditingSale}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Update the sale details below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Title*</Label>
              <Input
                id="edit-title"
                value={editingSale?.title || ""}
                onChange={(e) => handleEditSaleChange("title", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount ($)*</Label>
              <Input
                id="edit-amount"
                type="number"
                placeholder="0"
                value={editingSale?.amount || ""}
                onChange={(e) => handleEditSaleChange("amount", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-saleDate">Sale Date*</Label>
              <Input
                id="edit-saleDate"
                type="date"
                value={editingSale?.saleDate || ""}
                onChange={(e) => handleEditSaleChange("saleDate", e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select
                value={editingSale?.status || "completed"}
                onValueChange={(value) => handleEditSaleChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-productName">Product Name</Label>
              <Input
                id="edit-productName"
                placeholder="Product or service name"
                value={editingSale?.productName || ""}
                onChange={(e) => handleEditSaleChange("productName", e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-paymentMethod">Payment Method</Label>
              <Select
                value={editingSale?.paymentMethod || "credit_card"}
                onValueChange={(value) => handleEditSaleChange("paymentMethod", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-source">Source</Label>
              <Select
                value={editingSale?.source || "online"}
                onValueChange={(value) => handleEditSaleChange("source", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdateSale}>
              Update Sale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Sale Confirmation Dialog */}
      <AlertDialog open={isDeletingSale} onOpenChange={setIsDeletingSale}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sale</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this sale? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSaleToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteSale}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
} 