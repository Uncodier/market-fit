"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { getSaleById, getSaleOrderBySaleId, updateSale, deleteSale } from "@/app/sales/actions"
import { getSegments } from "@/app/segments/actions"
import { getCampaigns } from "@/app/campaigns/actions/campaigns/read"
import { Sale, SaleOrder } from "@/app/types"
import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { Pencil, Trash2, Printer, CreditCard } from "@/app/components/ui/icons"
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from "@/app/components/ui/alert-dialog"
import { EditSaleDialog } from "../components/EditSaleDialog"
import { CreateSaleOrderDialog } from "../components/CreateSaleOrderDialog"
import { RegisterPaymentDialog } from "../components/RegisterPaymentDialog"
import { StatusBar } from "../components/StatusBar"
import { SaleInvoice } from "../components/SaleInvoice"
import { SaleInvoiceSkeleton } from "../components/SaleInvoiceSkeleton"
import { upsertPolizaForSale, removePolizaForSource } from "@/app/accounting/ensure"

export default function SaleDetailPage(props: { params: Promise<{ id: string }> }) {
  const unwrappedParams = React.use(props.params);
  const router = useRouter();
  const { currentSite } = useSite();
  const { t } = useLocalization();
  const [sale, setSale] = useState<Sale | null>(null);
  const [saleOrder, setSaleOrder] = useState<SaleOrder | null>(null);
  const [segments, setSegments] = useState<Array<{ id: string; name: string }>>([]);
  const [campaigns, setCampaigns] = useState<Array<{ id: string; title: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const [isRegisterPaymentDialogOpen, setIsRegisterPaymentDialogOpen] = useState(false);

  useEffect(() => {
    async function loadSale() {
      if (!currentSite?.id || !unwrappedParams.id) return;

      document.title = `${t('layout.nav.sales.title') || 'Sales'} | Market Fit`;
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: t('sales.detail.breadcrumb') || 'Sale Details',
          path: `/sales/${unwrappedParams.id}`,
          section: 'sales'
        }
      });
      window.dispatchEvent(resetEvent);

      setLoading(true);
      try {
        const saleId = String(unwrappedParams.id);

        const saleResult = await getSaleById(currentSite.id, saleId);
        if (saleResult.error) {
          toast.error(saleResult.error);
          return;
        }

        if (saleResult.sale) {
          let loadedSale = saleResult.sale;
          const latestPaymentMethod =
            loadedSale.payments && loadedSale.payments.length > 0
              ? [...loadedSale.payments].sort(
                  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                )[0]?.method
              : undefined;
          const needsStatusSync =
            loadedSale.amount_due === 0 && loadedSale.status === "pending";
          const needsMethodSync =
            !!latestPaymentMethod && latestPaymentMethod !== loadedSale.paymentMethod;

          if (needsStatusSync || needsMethodSync) {
            const syncResult = await updateSale(currentSite.id, {
              ...loadedSale,
              status: needsStatusSync ? "completed" : loadedSale.status,
              paymentMethod: latestPaymentMethod || loadedSale.paymentMethod,
            });
            if (!syncResult.error) {
              const refreshed = await getSaleById(currentSite.id, saleId);
              if (refreshed.sale) loadedSale = refreshed.sale;
            }
          }

          setSale(loadedSale);
        }

        const saleOrderResult = await getSaleOrderBySaleId(currentSite.id, saleId);
        if (saleOrderResult.error) {
          toast.error(saleOrderResult.error);
        } else if (saleOrderResult.saleOrder) {
          setSaleOrder(saleOrderResult.saleOrder);
        }

        const segmentsResult = await getSegments(currentSite.id);
        if (segmentsResult.error) {
          console.error(segmentsResult.error);
        } else if (segmentsResult.segments) {
          setSegments(segmentsResult.segments.map(s => ({ id: s.id, name: s.name })));
        }

        const campaignsResult = await getCampaigns(currentSite.id);
        if (campaignsResult.error) {
          console.error(campaignsResult.error);
        } else if (campaignsResult.data) {
          setCampaigns(campaignsResult.data.map(c => ({ id: c.id, title: c.title })));
        }
      } catch (error) {
        console.error("Error loading sale:", error);
        toast.error(t('sales.detail.errorLoading') || "Error loading sale data");
      } finally {
        setLoading(false);
      }
    }

    loadSale();
  }, [currentSite, unwrappedParams.id, t]);

  useEffect(() => {
    if (sale) {
      document.title = `${sale.title} | ${t('layout.nav.sales.title') || 'Sales'}`;

      const event = new CustomEvent('breadcrumb:update', {
        detail: {
          title: sale.title,
          path: `/sales/${sale.id}`,
          section: 'sales'
        }
      });

      setTimeout(() => {
        window.dispatchEvent(event);
      }, 0);
    }

    return () => {
      document.title = `${t('layout.nav.sales.title') || 'Sales'} | Market Fit`;
    };
  }, [sale, t]);

  useEffect(() => {
    document.title = `${t('layout.nav.sales.title') || 'Sales'} | Market Fit`;

    return () => {
      document.title = `${t('layout.nav.sales.title') || 'Sales'} | Market Fit`;
      const resetEvent = new CustomEvent('breadcrumb:update', {
        detail: {
          title: null,
          path: null,
          section: 'sales'
        }
      });
      window.dispatchEvent(resetEvent);
    };
  }, [t]);

  const handleEdit = () => {
    setIsEditDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!currentSite?.id || !sale) return;

    try {
      const result = await deleteSale(currentSite.id, sale.id);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t('sales.detail.deleted') || "Sale deleted successfully");
        router.push("/sales");
      }
    } catch (error) {
      console.error("Error deleting sale:", error);
      toast.error(t('sales.detail.errorDeleting') || "Error deleting sale");
    }
  };

  const handlePrint = () => {
    if (sale) {
      window.open(`/invoice-pdf/${sale.id}`, '_blank');
    }
  };

  const handlePublish = async () => {
    if (!currentSite?.id || !sale) return;
    if (sale.status !== 'completed') {
      toast.error(t('sales.detail.publishOnlyCompleted') || "Only completed sales can be published");
      return;
    }

    try {
      await upsertPolizaForSale(sale.id, currentSite.id);
      toast.success(t('sales.detail.published') || "Sale published to journal");
      const saleResult = await getSaleById(currentSite.id, sale.id);
      if (saleResult.sale) setSale(saleResult.sale);
    } catch (e: any) {
      toast.error(e.message || (t('sales.detail.errorPublish') || "Failed to publish"));
    }
  };

  const handleUnpublish = async () => {
    if (!currentSite?.id || !sale) return;
    try {
      await removePolizaForSource('sale', sale.id);
      toast.success(t('sales.detail.unpublished') || "Sale unpublished");
      const saleResult = await getSaleById(currentSite.id, sale.id);
      if (saleResult.sale) setSale(saleResult.sale);
    } catch (e: any) {
      toast.error(e.message || (t('sales.detail.errorUnpublish') || "Failed to unpublish"));
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!currentSite?.id || !sale) return;

    try {
      const updatedSale: Sale = {
        ...sale,
        status: newStatus as "pending" | "completed" | "cancelled" | "refunded"
      };

      const result = await updateSale(currentSite.id, updatedSale);

      if (result.error) {
        toast.error(result.error);
      } else {
        const label = t(`sales.status.${newStatus}`) || newStatus;
        toast.success(`${t('sales.detail.statusUpdated') || 'Status updated to'} ${label}`);
        if (result.sale) {
          setSale(result.sale);
        }
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(t('sales.detail.errorStatus') || "Error updating status");
    }
  };

  const handleEditSuccess = async () => {
    if (!currentSite?.id || !unwrappedParams.id) return;

    setLoading(true);
    try {
      const saleId = String(unwrappedParams.id);
      const saleResult = await getSaleById(currentSite.id, saleId);

      if (saleResult.error) {
        toast.error(saleResult.error);
      } else if (saleResult.sale) {
        setSale(saleResult.sale);
      }
    } catch (error) {
      console.error("Error reloading sale:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrder = () => {
    setIsCreateOrderDialogOpen(true);
  };

  const handleOrderCreationSuccess = async () => {
    if (!currentSite?.id || !unwrappedParams.id) return;

    try {
      const saleId = String(unwrappedParams.id);
      const saleOrderResult = await getSaleOrderBySaleId(currentSite.id, saleId);

      if (saleOrderResult.error) {
        toast.error(saleOrderResult.error);
      } else if (saleOrderResult.saleOrder !== undefined) {
        setSaleOrder(saleOrderResult.saleOrder);
      }
    } catch (error) {
      console.error("Error refreshing sale order:", error);
    }
  };

  const handleRegisterPayment = () => {
    setIsRegisterPaymentDialogOpen(true);
  };

  const handlePaymentSuccess = async () => {
    if (!currentSite?.id || !unwrappedParams.id) return;

    try {
      const saleId = String(unwrappedParams.id);
      const saleResult = await getSaleById(currentSite.id, saleId);

      if (saleResult.error) {
        toast.error(saleResult.error);
      } else if (saleResult.sale) {
        setSale(saleResult.sale);
      }
    } catch (error) {
      console.error("Error refreshing sale:", error);
    }
  };

  return (
    <div className="flex-1 p-0">
      <StickyHeader>
        <div className="flex flex-col w-full">
          <div className="px-16 flex items-center justify-between h-[50px]">
            <div className="flex items-center gap-1">
              {sale && sale.amount_due > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRegisterPayment}
                    className="flex items-center gap-1 text-green-600 hover:bg-green-50 hover:text-green-700"
                  >
                    <CreditCard className="h-4 w-4" />
                    {t('sales.detail.registerPayment') || "Register Payment"}
                  </Button>

                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}

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

              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrint}
                className="flex items-center gap-1"
              >
                <Printer className="h-4 w-4" />
                {t('common.print') || "Print"}
              </Button>

              <div className="w-px h-6 bg-border mx-1" />

              {sale && (
                sale.accountingState !== 'posted' ? (
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
                    <AlertDialogTitle>{t('sales.detail.deleteTitle') || "Delete Sale"}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('sales.detail.deleteConfirm') || "Are you sure you want to delete this sale? This action cannot be undone."}
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

            <div className="flex items-center justify-end">
              {sale && (
                <StatusBar
                  currentStatus={sale.status}
                  onStatusChange={handleStatusChange}
                />
              )}
            </div>
          </div>
        </div>
      </StickyHeader>

      <div className="px-16 py-8 bg-muted/50 dark:bg-background min-h-screen">
        {loading ? (
          <SaleInvoiceSkeleton />
        ) : sale ? (
          <div className="max-w-6xl mx-auto">
            <div className="relative">
              <SaleInvoice
                sale={sale}
                saleOrder={saleOrder}
                segments={segments}
                campaigns={campaigns}
                siteName={currentSite?.name || ""}
                siteUrl={currentSite?.url || ""}
                onCreateOrder={handleCreateOrder}
              />
              <div className="absolute inset-0 rounded-lg shadow-xl -z-10 transform translate-y-1 bg-card/50 dark:bg-card/10 opacity-50 dark:border dark:border-border/30"></div>
              <div className="absolute inset-0 rounded-lg shadow-md -z-20 transform translate-y-2 bg-card/30 dark:bg-card/5 opacity-30 dark:border dark:border-border/20"></div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{t('saleNotFound') || "Sale not found"}</p>
          </div>
        )}
      </div>

      <EditSaleDialog
        sale={sale}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={handleEditSuccess}
      />

      <CreateSaleOrderDialog
        sale={sale}
        open={isCreateOrderDialogOpen}
        onOpenChange={setIsCreateOrderDialogOpen}
        onSuccess={handleOrderCreationSuccess}
      />

      <RegisterPaymentDialog
        sale={sale}
        open={isRegisterPaymentDialogOpen}
        onOpenChange={setIsRegisterPaymentDialogOpen}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
