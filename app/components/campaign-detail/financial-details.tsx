import React, { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { EmptyCard } from "@/app/components/ui/empty-card"
import { Input } from "@/app/components/ui/input"
import { Label } from "@/app/components/ui/label"
import { Button } from "@/app/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Badge } from "@/app/components/ui/badge"
import { FinancialStats } from "@/app/components/campaigns/financial-stats"
import { getCampaignTransactions } from "@/app/campaigns/actions/transactions/read"
import { deleteTransaction } from "@/app/campaigns/actions/transactions/delete"
import { CreateExpenseDialog } from "@/app/transactions/components/CreateExpenseDialog"
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
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
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
        toast.error("Failed to load expense data");
        return;
      }
      
      const formattedTransactions = result.data?.map(transaction => ({
        ...transaction,
        id: transaction.id,
        category: transaction.category,
        amount: transaction.amount,
        type: transaction.type,
        date: transaction.date,
        campaignId: transaction.campaignId,
        campaign_id: transaction.campaignId,
        locationId: transaction.locationId,
        location_id: transaction.locationId,
        leadId: transaction.leadId,
        lead_id: transaction.leadId,
        catalogItemId: transaction.catalogItemId,
        catalog_item_id: transaction.catalogItemId,
        catalogCategoryId: transaction.catalogCategoryId,
        catalog_category_id: transaction.catalogCategoryId,
        accountingState: transaction.accountingState,
        accounting_state: transaction.accountingState,
        description: transaction.description,
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
      toast.error("Failed to load expense data");
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
    // we need to set the full transaction so CreateExpenseDialog can use it
    setEditingTransaction(transaction);
    setIsExpenseDialogOpen(true);
  };
  
  
  const handleCreateNewExpense = () => {
    setEditingTransaction({ campaign_id: campaign.id, campaignId: campaign.id });
    setIsExpenseDialogOpen(true);
  };

  const handleDeleteTransaction = async () => {
    if (!transactionToDelete) {
      toast.error("Expense ID is missing");
      return;
    }
    
    try {
      const result = await deleteTransaction(transactionToDelete);
      
      if (result.error) {
        toast.error(result.error);
        return;
      }
      
      toast.success("Expense deleted successfully");
      setIsDeletingTransaction(false);
      setTransactionToDelete(null);
      
      // Reload transactions to reflect the deletion
      loadTransactions();
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error("Failed to delete expense");
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
          <div>
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="text-lg font-medium">Campaign Costs</h3>
              <Button variant="outline" size="sm" onClick={handleCreateNewExpense}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
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
                          title="No expenses"
                          description="No expenses recorded yet"
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
          </div>
          
          {/* Sales component added below costs in the left column */}
          <CampaignSales campaign={campaign} />
        </div>
        
        {/* Right side: Financial Widgets - 40% */}
        <div className="md:col-span-4 order-1 md:order-2 space-y-6">
          {/* Financial Overview */}
          <div>
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h3 className="text-lg font-medium">Financial Overview</h3>
            </div>

            <FinancialStats 
              revenue={campaign.revenue || { actual: 0, projected: 0, estimated: 0, currency: "USD" }}
              budget={campaign.budget || { allocated: 0, remaining: 0, currency: "USD" }}
              costs={calculatedCosts}
            />
          </div>
        </div>
      </div>

      {/* Edit Expense Dialog */}
      {currentSite?.id && (
        <CreateExpenseDialog
          siteId={currentSite.id}
          open={isExpenseDialogOpen}
          onOpenChange={setIsExpenseDialogOpen}
          onSuccess={loadTransactions}
          expenseToEdit={editingTransaction}
        />
      )}

      {/* Delete Expense Confirmation Dialog */}
      <AlertDialog open={isDeletingTransaction} onOpenChange={setIsDeletingTransaction}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTransactionToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTransaction}
              className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 