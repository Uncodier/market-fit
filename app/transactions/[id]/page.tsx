"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getExpenseById, deleteExpense } from "@/app/transactions/actions"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Pencil, Trash2 } from "@/app/components/ui/icons"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from "@/app/components/ui/alert-dialog"
import { CreateExpenseDialog } from "../components/CreateExpenseDialog"
import { ExpenseDocument } from "../components/ExpenseDocument"
import { ExpenseDocumentSkeleton } from "../components/ExpenseDocumentSkeleton"
import { upsertPolizaForExpense, removePolizaForSource } from "@/app/accounting/ensure"
import { getActiveExpenseAccounts } from "@/app/accounting/chart"

export default function ExpenseDetailPage(props: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(props.params);
  const router = useRouter();
  const { currentSite } = useSite();
  const { t } = useLocalization();
  const [expense, setExpense] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [categoryLabel, setCategoryLabel] = useState<string>('');

  useEffect(() => {
    async function loadExpense() {
      if (!currentSite?.id || !unwrappedParams.id) return;

      document.title = `${t('layout.sidebar.transactions') || 'Expenses'} | Market Fit`;
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: t('expenses.detail.breadcrumb') || 'Expense Details',
          path: `/transactions/${unwrappedParams.id}`,
          section: 'transactions'
        }
      });
      window.dispatchEvent(resetEvent);

      setLoading(true);
      try {
        const expenseId = String(unwrappedParams.id);

        const expenseResult = await getExpenseById(currentSite.id, expenseId);
        if (expenseResult.error) {
          toast.error(expenseResult.error);
          return;
        }

        if (expenseResult.expense) {
          setExpense(expenseResult.expense);
          
          const accounts = await getActiveExpenseAccounts(currentSite.id);
          const account = accounts.find(a => (a.key || a.code) === expenseResult.expense.category);
          setCategoryLabel(account?.label || expenseResult.expense.category);
        }
      } catch (error) {
        console.error("Error loading expense:", error);
        toast.error(t('expenses.detail.errorLoading') || "Error loading expense data");
      } finally {
        setLoading(false);
      }
    }

    loadExpense();
  }, [currentSite, unwrappedParams.id, t]);

  useEffect(() => {
    if (expense) {
      const title = expense.description || categoryLabel || t('expenses.detail.breadcrumb') || 'Expense Details';
      document.title = `${title} | ${t('layout.sidebar.transactions') || 'Expenses'}`;

      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: title,
          path: `/transactions/${expense.id}`,
          section: 'transactions'
        }
      });

      setTimeout(() => {
        window.dispatchEvent(event);
      }, 0);
    }

    return () => {
      document.title = `${t('layout.sidebar.transactions') || 'Expenses'} | Market Fit`;
    };
  }, [expense, categoryLabel, t]);

  useEffect(() => {
    document.title = `${t('layout.sidebar.transactions') || 'Expenses'} | Market Fit`;

    return () => {
      document.title = `${t('layout.sidebar.transactions') || 'Expenses'} | Market Fit`;
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: null,
          path: null,
          section: 'transactions'
        }
      });
      window.dispatchEvent(resetEvent);
    };
  }, [t]);

  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!currentSite?.id || !expense) return;

    try {
      const result = await deleteExpense(expense.id, currentSite.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t('expenses.detail.deleted') || "Expense deleted successfully");
        router.push("/transactions");
      }
    } catch (error) {
      console.error("Error deleting expense:", error);
      toast.error(t('expenses.detail.errorDeleting') || "Error deleting expense");
    }
  };

  const handlePublish = async () => {
    if (!currentSite?.id || !expense) return;

    try {
      await upsertPolizaForExpense(expense.id, currentSite.id);
      toast.success(t('expenses.success.published') || "Expense published to journal");
      const expenseResult = await getExpenseById(currentSite.id, expense.id);
      if (expenseResult.expense) setExpense(expenseResult.expense);
    } catch (e: any) {
      toast.error(e.message || (t('expenses.error.publish') || "Failed to publish"));
    }
  };

  const handleUnpublish = async () => {
    if (!currentSite?.id || !expense) return;
    try {
      await removePolizaForSource('expense', expense.id);
      toast.success(t('expenses.success.unpublished') || "Expense unpublished");
      const expenseResult = await getExpenseById(currentSite.id, expense.id);
      if (expenseResult.expense) setExpense(expenseResult.expense);
    } catch (e: any) {
      toast.error(e.message || (t('expenses.error.unpublish') || "Failed to unpublish"));
    }
  };

  const handleEditSuccess = async () => {
    if (!currentSite?.id || !unwrappedParams.id) return;

    setLoading(true);
    try {
      const expenseId = String(unwrappedParams.id);
      const expenseResult = await getExpenseById(currentSite.id, expenseId);

      if (expenseResult.error) {
        toast.error(expenseResult.error);
      } else if (expenseResult.expense) {
        setExpense(expenseResult.expense);
      }
    } catch (error) {
      console.error("Error reloading expense:", error);
    } finally {
      setLoading(false);
      setIsEditDialogOpen(false);
    }
  };

  return (
    <div className="flex-1 p-0">
      <StickyHeader>
        <div className="flex flex-col w-full">
          <div className="px-16 flex items-center h-[50px]">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                className="flex items-center gap-1"
              >
                <Pencil className="h-4 w-4" />
                {t('common.edit') || "Edit"}
              </Button>

              <div className="w-px h-6 bg-border mx-1" />

              {expense && (
                expense.accounting_state !== 'posted' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePublish}
                    className="flex items-center gap-1 text-primary hover:bg-primary/10"
                  >
                    {t('common.publish') || "Publish"}
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnpublish}
                    className="flex items-center gap-1 text-orange-600 hover:bg-orange-50"
                  >
                    {t('common.cancel') || "Cancel"}
                  </Button>
                )
              )}

              <div className="w-px h-6 bg-border mx-1" />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t('common.delete') || "Delete"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('expenses.detail.deleteTitle') || "Delete Expense"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('expenses.detail.deleteConfirm') || "Are you sure you want to delete this expense? This action cannot be undone."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('common.cancel') || "Cancel"}</AlertDialogCancel>
                    <AlertDialogAction className="!bg-destructive hover:!bg-destructive/90 !text-destructive-foreground" onClick={handleDelete}>
                      {t('common.delete') || "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="px-16 py-8 bg-muted/50 dark:bg-background min-h-screen">
        {loading ? (
          <ExpenseDocumentSkeleton />
        ) : expense ? (
          <div className="max-w-[800px] mx-auto">
            <div className="relative">
              <ExpenseDocument
                expense={expense}
                siteName={currentSite?.name || ""}
                siteUrl={currentSite?.url || ""}
              />
              <div className="absolute inset-0 rounded-lg shadow-xl -z-10 transform translate-y-1 bg-card/50 dark:bg-card/10 opacity-50 dark:border dark:border-border/30"></div>
              <div className="absolute inset-0 rounded-lg shadow-md -z-20 transform translate-y-2 bg-card/30 dark:bg-card/5 opacity-30 dark:border dark:border-border/20"></div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{t('expenses.detail.notFound') || "Expense not found"}</p>
          </div>
        )}
      </div>

      <CreateExpenseDialog
        siteId={currentSite?.id || ""}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
        expenseToEdit={expense}
      />
    </div>
  );
}
