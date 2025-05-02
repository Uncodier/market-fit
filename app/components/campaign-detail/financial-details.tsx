import React, { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent } from "@/app/components/ui/card"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Badge } from "@/app/components/ui/badge"
import { FinancialStats } from "@/app/components/control-center/financial-stats"
import { getCampaignTransactions } from "@/app/control-center/actions/transactions/read"
import { createTransaction } from "@/app/control-center/actions/transactions/create"
import { updateTransaction } from "@/app/control-center/actions/transactions/update"
import { deleteTransaction } from "@/app/control-center/actions/transactions/delete"
import { Revenue, Budget } from "@/app/types"
import { useSite } from "@/app/context/SiteContext"
import { CampaignSales } from "./campaign-sales"
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

interface FinancialDetailsProps {
  campaign: any;
  onUpdateCampaign: (data: any) => void;
}

export function FinancialDetails({ campaign, onUpdateCampaign }: FinancialDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [newTransaction, setNewTransaction] = useState({
    category: "content",
    amount: "",
    type: "fixed",
    date: new Date().toISOString().split('T')[0],
    notes: ""
  });
  const [financialData, setFinancialData] = useState<{
    revenue: Revenue;
    budget: Budget;
    costs: {
      fixed: number;
      variable: number;
      total: number;
      currency: string;
    };
  }>({
    revenue: { actual: 0, projected: 0, estimated: 0, currency: "USD" },
    budget: { allocated: 0, remaining: 0, currency: "USD" },
    costs: { fixed: 0, variable: 0, total: 0, currency: "USD" }
  });
  
  // Add states for edit and delete dialogs
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [isEditingTransaction, setIsEditingTransaction] = useState(false);
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  
  const params = useParams();
  const { currentSite } = useSite();
  
  // Función para cargar las transacciones
  const loadTransactions = async () => {
    if (!campaign?.id) return;
    
    try {
      setLoadingTransactions(true);
      const result = await getCampaignTransactions(campaign.id);
      
      if (result.error) {
        console.error("Error loading transactions:", result.error);
        toast.error("Failed to load transaction data");
        return;
      }
      
      // Transformar las transacciones al formato esperado por la tabla
      const formattedTransactions = result.data?.map(transaction => ({
        id: transaction.id,
        category: transaction.category, // Usar category directamente
        amount: transaction.amount,
        type: transaction.type,
        date: transaction.date
      })) || [];
      
      setTransactions(formattedTransactions);
      
      // Calcular los costos reales basados en las transacciones
      if (formattedTransactions.length > 0) {
        let fixedCosts = 0;
        let variableCosts = 0;
        
        formattedTransactions.forEach(transaction => {
          if (transaction.type === 'fixed') {
            fixedCosts += Number(transaction.amount);
          } else if (transaction.type === 'variable') {
            variableCosts += Number(transaction.amount);
          }
        });
        
        const totalCosts = fixedCosts + variableCosts;
        
        // Actualizar el estado financiero con los costos reales
        setFinancialData(prev => ({
          ...prev,
          costs: {
            fixed: fixedCosts,
            variable: variableCosts,
            total: totalCosts,
            currency: prev.costs.currency
          },
          budget: {
            ...prev.budget,
            remaining: (prev.budget.allocated || 0) - totalCosts
          }
        }));
      }
    } catch (error) {
      console.error("Error in loadTransactions:", error);
      toast.error("Failed to load transaction data");
    } finally {
      setLoadingTransactions(false);
    }
  };
  
  // Initialize financial data and load transactions when campaign changes
  useEffect(() => {
    if (campaign) {
      // Initialize financial data with the values from the campaign
      const initialFinancialData = {
        revenue: { 
          actual: campaign.revenue?.actual || 0,
          projected: campaign.revenue?.projected || 0,
          estimated: campaign.revenue?.estimated || 0,
          currency: campaign.revenue?.currency || "USD"
        },
        budget: { 
          allocated: campaign.budget?.allocated || 0,
          remaining: campaign.budget?.remaining || 0,
          currency: campaign.budget?.currency || "USD"
        },
        costs: {
          fixed: 0, // These values will be calculated when transactions are loaded
          variable: 0,
          total: campaign.budget?.allocated && campaign.budget?.remaining 
            ? campaign.budget.allocated - campaign.budget.remaining 
            : 0,
          currency: campaign.budget?.currency || "USD"
        }
      };
      
      setFinancialData(initialFinancialData);
      
      // Load the transactions, which will update the costs when completed
      loadTransactions();
    }
  }, [campaign]);

  const handleChange = (section: 'revenue' | 'budget' | 'costs', field: string, value: string) => {
    // Only allow updates to editable fields
    if ((section === 'revenue' && (field === 'actual' || field === 'estimated')) || 
        (section === 'budget' && field === 'allocated')) {
      
      const parsedValue = value ? parseInt(value) : 0;
      
      setFinancialData(prev => {
        // Create a new state object with the same structure
        const updated = {
          revenue: { ...prev.revenue },
          budget: { ...prev.budget },
          costs: { ...prev.costs }
        };
        
        // Update the specific field
        if (section === 'revenue') {
          updated.revenue = {
            ...updated.revenue,
            [field]: parsedValue
          };
        } else if (section === 'budget') {
          updated.budget = {
            ...updated.budget,
            [field]: parsedValue
          };
          
          // If we changed allocated budget, recalculate the remaining budget
          if (field === 'allocated') {
            updated.budget.remaining = parsedValue - updated.costs.total;
          }
        }
        
        return updated;
      });
    }
  };

  const handleTransactionChange = (field: string, value: string) => {
    setNewTransaction(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddTransaction = async () => {
    if (!newTransaction.amount || parseFloat(newTransaction.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const categoryLabels: Record<string, string> = {
      "content": "Content Creation",
      "advertising": "Digital Advertising",
      "tools": "Marketing Tools",
      "freelance": "Freelancer Support",
      "adspend": "Ad Spend"
    };

    try {
      if (!currentSite?.id) {
        toast.error("Site information is missing");
        return;
      }

      // Create the transaction data to send to the database
      const transactionData = {
        campaignId: campaign.id,
        type: newTransaction.type as 'fixed' | 'variable',
        amount: parseFloat(newTransaction.amount),
        description: newTransaction.notes || categoryLabels[newTransaction.category] || newTransaction.category,
        category: newTransaction.category,
        date: newTransaction.date,
        currency: "USD",
        siteId: currentSite.id,
        userId: currentSite.user_id // Using the site's user ID
      };

      // Save transaction to the database
      const result = await createTransaction(transactionData);
      
      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Transaction added successfully");
      
      // Reset form
      setNewTransaction({
        category: "content",
        amount: "",
        type: "fixed",
        date: new Date().toISOString().split('T')[0],
        notes: ""
      });
      
      // Después de agregar una transacción, simplemente volvemos a cargar las transacciones
      await loadTransactions();
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast.error("Failed to add transaction. Please try again.");
    }
  };

  const handleSave = () => {
    // First ensure we have the correct calculated values
    
    // Keep costs as they are since they're derived from transactions
    const costs = {
      fixed: financialData.costs.fixed,
      variable: financialData.costs.variable,
      total: financialData.costs.fixed + financialData.costs.variable,
      currency: financialData.costs.currency
    };
    
    // Calculate remaining budget from allocated budget and total costs
    const budget = {
      allocated: financialData.budget.allocated || 0,
      remaining: (financialData.budget.allocated || 0) - costs.total,
      currency: financialData.budget.currency
    };
    
    // Only update actual and estimated revenue, keeping projected as is
    const revenue = {
      actual: typeof financialData.revenue.actual === 'string' ? 
        parseFloat(financialData.revenue.actual) || 0 : 
        (financialData.revenue.actual || 0),
      estimated: typeof financialData.revenue.estimated === 'string' ? 
        parseFloat(financialData.revenue.estimated) || 0 : 
        (financialData.revenue.estimated || 0),
      projected: typeof financialData.revenue.projected === 'string' ? 
        parseFloat(financialData.revenue.projected) || 0 : 
        (financialData.revenue.projected || 0),
      currency: financialData.revenue.currency || "USD"
    };
    
    // Build the data to update
    const updatedData = {
      revenue: revenue,
      budget: budget,
      costs: costs
    };
    
    // Call the update function
    onUpdateCampaign(updatedData);
    setIsEditing(false);
  };

  // Calculate costs for display (usa el estado actualizado de financialData)
  const calculatedCosts = {
    fixed: financialData.costs.fixed,
    variable: financialData.costs.variable,
    total: financialData.costs.total,
    currency: financialData.costs.currency || "USD"
  };
  
  // Calcular el total actual de las transacciones para mostrar en la tabla
  const transactionsTotal = transactions.reduce((sum, cost) => sum + Number(cost.amount), 0);

  // Add handlers for edit and delete
  const handleEditTransaction = (transaction: any) => {
    setEditingTransaction({
      id: transaction.id,
      category: transaction.category,
      amount: transaction.amount.toString(),
      type: transaction.type,
      date: transaction.date
    });
    setIsEditingTransaction(true);
  };
  
  const handleEditTransactionChange = (field: string, value: string) => {
    setEditingTransaction((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleUpdateTransaction = async () => {
    if (!editingTransaction || !editingTransaction.id) {
      toast.error("Transaction data is missing");
      return;
    }
    
    if (!editingTransaction.amount || parseFloat(editingTransaction.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    
    try {
      const result = await updateTransaction(editingTransaction.id, {
        type: editingTransaction.type as 'fixed' | 'variable',
        amount: parseFloat(editingTransaction.amount),
        description: editingTransaction.category,
        category: editingTransaction.category,
        date: editingTransaction.date
      });
      
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      toast.success("Transaction updated successfully");
      setIsEditingTransaction(false);
      
      // Reload transactions to reflect the update
      loadTransactions();
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast.error("Failed to update transaction");
    }
  };
  
  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) {
      toast.error("Transaction ID is missing");
      return;
    }
    
    try {
      const result = await deleteTransaction(transactionToDelete);
      
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      toast.success("Transaction deleted successfully");
      setIsDeletingTransaction(false);
      setTransactionToDelete(null);
      
      // Reload transactions to reflect the deletion
      loadTransactions();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error("Failed to delete transaction");
    }
  };
  
  const handleOpenDeleteDialog = (id: string) => {
    setTransactionToDelete(id);
    setIsDeletingTransaction(true);
  };

  return (
    <div className="space-y-6">      
      <div className="grid grid-cols-1 md:grid-cols-10 gap-6">
        {/* Left side: Cost Breakdown - 60% */}
        <div className="md:col-span-6 order-2 md:order-1 space-y-6">
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h3 className="text-lg font-medium">Campaign Costs</h3>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Transaction
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="sm:max-w-[425px]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Add New Transaction</AlertDialogTitle>
                      <AlertDialogDescription>
                        Add a new transaction to the campaign cost breakdown.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="transaction-category">Category</Label>
                        <Select 
                          defaultValue={newTransaction.category}
                          onValueChange={(value) => handleTransactionChange('category', value)}
                        >
                          <SelectTrigger id="transaction-category" className="h-12">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Marketing expenses */}
                            <SelectItem value="advertising">Advertising</SelectItem>
                            <SelectItem value="content">Content Creation</SelectItem>
                            <SelectItem value="adspend">Ad Spend</SelectItem>
                            <SelectItem value="seo">SEO Services</SelectItem>
                            <SelectItem value="social">Social Media Marketing</SelectItem>
                            <SelectItem value="email">Email Marketing</SelectItem>
                            <SelectItem value="events">Events and Conferences</SelectItem>
                            <SelectItem value="print">Print Materials</SelectItem>
                            <SelectItem value="sponsorship">Sponsorships</SelectItem>
                            
                            {/* Sales expenses */}
                            <SelectItem value="sales_commission">Sales Commissions</SelectItem>
                            <SelectItem value="sales_travel">Sales Travel</SelectItem>
                            <SelectItem value="crm">CRM and Sales Tools</SelectItem>
                            
                            {/* Technology expenses */}
                            <SelectItem value="software">Software Subscriptions</SelectItem>
                            <SelectItem value="hosting">Hosting and Infrastructure</SelectItem>
                            <SelectItem value="tools">Marketing Tools</SelectItem>
                            
                            {/* Operational expenses */}
                            <SelectItem value="freelance">Freelancer Support</SelectItem>
                            <SelectItem value="agency">Agency Fees</SelectItem>
                            <SelectItem value="consulting">Consulting Services</SelectItem>
                            <SelectItem value="research">Market Research</SelectItem>
                            <SelectItem value="utilities">Utilities</SelectItem>
                            <SelectItem value="rent">Office Rent</SelectItem>
                            
                            {/* Administrative expenses */}
                            <SelectItem value="salaries">Salaries and Benefits</SelectItem>
                            <SelectItem value="insurance">Insurance</SelectItem>
                            <SelectItem value="legal">Legal and Professional</SelectItem>
                            <SelectItem value="travel">Travel and Entertainment</SelectItem>
                            <SelectItem value="training">Training and Development</SelectItem>
                            
                            {/* Other expenses */}
                            <SelectItem value="other">Other Expenses</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="transaction-amount">Amount</Label>
                        <div className="flex items-center h-12 border rounded-md border-input px-3 bg-background">
                          <span className="text-sm text-muted-foreground mr-2">$</span>
                          <Input 
                            id="transaction-amount" 
                            type="number" 
                            placeholder="0"
                            value={newTransaction.amount}
                            onChange={(e) => handleTransactionChange('amount', e.target.value)}
                            className="border-0 h-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="transaction-type">Type</Label>
                        <Select 
                          defaultValue={newTransaction.type}
                          onValueChange={(value) => handleTransactionChange('type', value)}
                        >
                          <SelectTrigger id="transaction-type" className="h-12">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed</SelectItem>
                            <SelectItem value="variable">Variable</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="transaction-date">Date</Label>
                        <Input 
                          id="transaction-date" 
                          type="date" 
                          value={newTransaction.date}
                          onChange={(e) => handleTransactionChange('date', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="transaction-notes">Notes (Optional)</Label>
                        <Input 
                          id="transaction-notes" 
                          type="text" 
                          placeholder="Enter any additional details"
                          value={newTransaction.notes}
                          onChange={(e) => handleTransactionChange('notes', e.target.value)}
                        />
                      </div>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAddTransaction}>Add Transaction</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              
              <div className="rounded-md border overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left p-3 font-medium text-sm">Category</th>
                      <th className="text-left p-3 font-medium text-sm">Amount</th>
                      <th className="text-left p-3 font-medium text-sm">Type</th>
                      <th className="text-left p-3 font-medium text-sm">Date</th>
                      <th className="text-left p-3 font-medium text-sm w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loadingTransactions ? (
                      <tr>
                        <td colSpan={5} className="p-4">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center py-3 border-b last:border-0">
                              <div className="flex-1">
                                <Skeleton className="h-4 w-32" />
                              </div>
                              <div className="flex-1">
                                <Skeleton className="h-4 w-16" />
                              </div>
                              <div className="flex-1">
                                <Skeleton className="h-6 w-16 rounded-full" />
                              </div>
                              <div className="flex-1">
                                <Skeleton className="h-4 w-24" />
                              </div>
                              <div className="w-10">
                                <Skeleton className="h-4 w-6" />
                              </div>
                            </div>
                          ))}
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center">
                          <EmptyCard
                            icon={<BarChart className="h-8 w-8 text-muted-foreground" />}
                            title="No transactions"
                            description="No transactions recorded yet"
                            className="border-none shadow-none"
                            contentClassName="py-4"
                          />
                        </td>
                      </tr>
                    ) : (
                      <>
                        {transactions.map((cost, index) => (
                          <tr key={cost.id || index} className="hover:bg-muted/10 transition-colors">
                            <td className="p-3">{cost.category}</td>
                            <td className="p-3">{formatCurrency(cost.amount)}</td>
                            <td className="p-3">
                              <Badge variant={cost.type === "fixed" ? "outline" : "secondary"} className="text-xs">
                                {cost.type === "fixed" ? "Fixed" : "Variable"}
                              </Badge>
                            </td>
                            <td className="p-3">{cost.date || "N/A"}</td>
                            <td className="p-3 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <span className="text-base leading-none">⋮</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditTransaction(cost)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => handleOpenDeleteDialog(cost.id)}
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
                          <td className="p-3">Total</td>
                          <td className="p-3">{formatCurrency(transactionsTotal)}</td>
                          <td className="p-3"></td>
                          <td className="p-3"></td>
                          <td className="p-3"></td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          
          {/* Sales component added below costs in the left column */}
          <CampaignSales campaign={campaign} />
        </div>
        
        {/* Right side: Financial Widgets - 40% */}
        <div className="md:col-span-4 order-1 md:order-2 space-y-6">
          {/* Financial Overview Card */}
          <Card>
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <h3 className="text-lg font-medium">Financial Overview</h3>
                {!isEditing ? (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <span className="mr-2">✏️</span> Edit 
                  </Button>
                ) : (
                  <div className="space-x-2">
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <span className="mr-2">💾</span> Save
                    </Button>
                  </div>
                )}
              </div>

              {!isEditing ? (
                <FinancialStats 
                  revenue={campaign.revenue || { actual: 0, projected: 0, estimated: 0, currency: "USD" }}
                  budget={campaign.budget || { allocated: 0, remaining: 0, currency: "USD" }}
                  costs={calculatedCosts}
                />
              ) : (
                <div className="space-y-6">
                  {/* Revenue Editing */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Revenue</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="actual-revenue">Actual Revenue</Label>
                        <Input 
                          id="actual-revenue" 
                          type="number" 
                          value={financialData.revenue.actual || ''} 
                          onChange={(e) => handleChange('revenue', 'actual', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="projected-revenue">Projected Revenue</Label>
                        <Input 
                          id="projected-revenue" 
                          type="number" 
                          value={financialData.revenue.projected || ''} 
                          disabled
                        />
                        <p className="text-xs text-muted-foreground">Automatically calculated</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estimated-revenue">Estimated Revenue</Label>
                        <Input 
                          id="estimated-revenue" 
                          type="number" 
                          value={financialData.revenue.estimated || ''} 
                          onChange={(e) => handleChange('revenue', 'estimated', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Budget Editing */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Budget</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="allocated-budget">Allocated Budget</Label>
                        <Input 
                          id="allocated-budget" 
                          type="number" 
                          value={financialData.budget.allocated || ''} 
                          onChange={(e) => handleChange('budget', 'allocated', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="remaining-budget">Remaining Budget</Label>
                        <Input 
                          id="remaining-budget" 
                          type="number" 
                          value={financialData.budget.remaining || ''} 
                          disabled
                        />
                        <p className="text-xs text-muted-foreground">Automatically calculated from allocated budget minus total costs</p>
                      </div>
                    </div>
                  </div>

                  {/* Costs Editing */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Costs</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="fixed-costs">Fixed Costs</Label>
                        <Input 
                          id="fixed-costs" 
                          type="number" 
                          value={financialData.costs.fixed || ''} 
                          disabled
                        />
                        <p className="text-xs text-muted-foreground">Based on fixed transaction costs</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="variable-costs">Variable Costs</Label>
                        <Input 
                          id="variable-costs" 
                          type="number" 
                          value={financialData.costs.variable || ''} 
                          disabled
                        />
                        <p className="text-xs text-muted-foreground">Based on variable transaction costs</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="total-costs">Total Costs</Label>
                        <Input 
                          id="total-costs" 
                          type="number" 
                          value={(financialData.costs.fixed || 0) + (financialData.costs.variable || 0)} 
                          disabled
                        />
                        <p className="text-xs text-muted-foreground">Sum of fixed and variable costs</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Transaction Dialog */}
      <AlertDialog open={isEditingTransaction} onOpenChange={setIsEditingTransaction}>
        <AlertDialogContent className="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Update the transaction details below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-transaction-category">Category</Label>
              <Select 
                value={editingTransaction?.category || ""}
                onValueChange={(value) => handleEditTransactionChange('category', value)}
              >
                <SelectTrigger id="edit-transaction-category" className="h-12">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {/* Marketing expenses */}
                  <SelectItem value="advertising">Advertising</SelectItem>
                  <SelectItem value="content">Content Creation</SelectItem>
                  <SelectItem value="adspend">Ad Spend</SelectItem>
                  <SelectItem value="seo">SEO Services</SelectItem>
                  <SelectItem value="social">Social Media Marketing</SelectItem>
                  <SelectItem value="email">Email Marketing</SelectItem>
                  <SelectItem value="events">Events and Conferences</SelectItem>
                  <SelectItem value="print">Print Materials</SelectItem>
                  <SelectItem value="sponsorship">Sponsorships</SelectItem>
                  
                  {/* Sales expenses */}
                  <SelectItem value="sales_commission">Sales Commissions</SelectItem>
                  <SelectItem value="sales_travel">Sales Travel</SelectItem>
                  <SelectItem value="crm">CRM and Sales Tools</SelectItem>
                  
                  {/* Technology expenses */}
                  <SelectItem value="software">Software Subscriptions</SelectItem>
                  <SelectItem value="hosting">Hosting and Infrastructure</SelectItem>
                  <SelectItem value="tools">Marketing Tools</SelectItem>
                  
                  {/* Operational expenses */}
                  <SelectItem value="freelance">Freelancer Support</SelectItem>
                  <SelectItem value="agency">Agency Fees</SelectItem>
                  <SelectItem value="consulting">Consulting Services</SelectItem>
                  <SelectItem value="research">Market Research</SelectItem>
                  <SelectItem value="utilities">Utilities</SelectItem>
                  <SelectItem value="rent">Office Rent</SelectItem>
                  
                  {/* Administrative expenses */}
                  <SelectItem value="salaries">Salaries and Benefits</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="legal">Legal and Professional</SelectItem>
                  <SelectItem value="travel">Travel and Entertainment</SelectItem>
                  <SelectItem value="training">Training and Development</SelectItem>
                  
                  {/* Other expenses */}
                  <SelectItem value="other">Other Expenses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-transaction-amount">Amount</Label>
              <div className="flex items-center h-12 border rounded-md border-input px-3 bg-background">
                <span className="text-sm text-muted-foreground mr-2">$</span>
                <Input 
                  id="edit-transaction-amount" 
                  type="number" 
                  placeholder="0"
                  value={editingTransaction?.amount || ""}
                  onChange={(e) => handleEditTransactionChange('amount', e.target.value)}
                  className="border-0 h-full p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-transaction-type">Type</Label>
              <Select 
                value={editingTransaction?.type || "fixed"}
                onValueChange={(value) => handleEditTransactionChange('type', value)}
              >
                <SelectTrigger id="edit-transaction-type" className="h-12">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-transaction-date">Date</Label>
              <Input 
                id="edit-transaction-date" 
                type="date" 
                value={editingTransaction?.date || ""}
                onChange={(e) => handleEditTransactionChange('date', e.target.value)}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUpdateTransaction}>Update Transaction</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Transaction Confirmation Dialog */}
      <AlertDialog open={isDeletingTransaction} onOpenChange={setIsDeletingTransaction}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTransactionToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTransaction}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 