import React, { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHeader, TableRow } from "@/app/components/ui/table"
import { Button } from "@/app/components/ui/button"
import { Send, Printer, CreditCard, ShoppingCart } from "@/app/components/ui/icons"
import { Skeleton } from "@/app/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/app/components/ui/tooltip"
import { format } from "date-fns"
import { toast } from "sonner"
import { Sale } from "@/app/types"
import { formatCurrency } from "@/app/lib/formatters"
import { useSite } from "@/app/context/SiteContext"
import { useLocalization } from "@/app/context/LocalizationContext"
import { createClient } from "@/lib/supabase/client"
import { getSales } from "@/app/sales/actions"
import { useRouter } from "next/navigation"
import { navigateToSale } from "@/lib/navigation/navigation-helpers"
import { EmptyCard } from "@/app/components/ui/empty-card"
import {
  DocumentListHead,
  DocumentListRow,
  EntityCell,
  MoneyCell,
  StatusDot,
  documentListShellClassName,
  documentRowAccent,
} from "@/app/components/documents/document-list"

interface SalesViewProps {
  leadId: string
}

function formatDate(dateString: string) {
  try {
    return format(new Date(dateString), "MMM d, yyyy")
  } catch {
    return dateString
  }
}

export function SalesView({ leadId }: SalesViewProps) {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const { currentSite } = useSite()
  const { t } = useLocalization()
  const router = useRouter()

  useEffect(() => {
    const loadSales = async () => {
      if (!currentSite?.id || !leadId) return

      setLoading(true)
      try {
        const result = await getSales(currentSite.id)

        if (result.error || !result.sales) {
          const supabase = createClient()
          const { data, error } = await supabase
            .from("sales")
            .select("*")
            .eq("lead_id", leadId)
            .order("sale_date", { ascending: false })

          if (error || !data || data.length === 0) {
            setSales([])
          } else {
            setSales(
              data.map((item: any) => ({
                id: item.id,
                title: item.title || "Unnamed Sale",
                productName: item.product_name || "",
                productType: item.product_type || "",
                amount: item.amount || 0,
                amount_due: item.amount_due || 0,
                currency: item.currency || "USD",
                status: item.status || "pending",
                source: item.source || "online",
                saleDate: item.sale_date,
                leadId: item.lead_id,
                leadName: item.lead_name || "Client",
                campaignId: item.campaign_id,
                segmentId: item.segment_id,
                paymentMethod: item.payment_method,
                paymentDetails: null,
                channel: item.channel || "",
                notes: item.notes || "",
                tags: item.tags || [],
                siteId: item.site_id,
                userId: item.user_id,
                createdAt: item.created_at,
                updatedAt: item.updated_at,
              }))
            )
          }
        } else {
          setSales(result.sales.filter((sale) => sale.leadId === leadId))
        }
      } catch (error) {
        console.error("Error loading sales:", error)
        toast.error("Failed to load sales")
        setSales([])
      } finally {
        setLoading(false)
      }
    }

    loadSales()
  }, [leadId, currentSite?.id])

  const handleViewSale = (sale: Sale) => {
    navigateToSale({
      saleId: sale.id,
      saleName: sale.title || `Sale ${sale.id.substring(0, 8)}`,
      router,
    })
  }

  const handleRegisterPayment = (sale: Sale, e: React.MouseEvent) => {
    e.stopPropagation()
    navigateToSale({
      saleId: sale.id,
      saleName: sale.title || `Sale ${sale.id.substring(0, 8)}`,
      action: "payment",
      router,
    })
  }

  const handleSendSale = (sale: Sale, e: React.MouseEvent) => {
    e.stopPropagation()
    navigateToSale({
      saleId: sale.id,
      saleName: sale.title || `Sale ${sale.id.substring(0, 8)}`,
      action: "send",
      router,
    })
  }

  const handlePrintSale = (sale: Sale, e: React.MouseEvent) => {
    e.stopPropagation()
    navigateToSale({
      saleId: sale.id,
      saleName: sale.title || `Sale ${sale.id.substring(0, 8)}`,
      action: "print",
      router,
    })
  }

  const totalAmount = sales.reduce((sum, sale) => sum + (sale.amount || 0), 0)
  const totalAmountDue = sales.reduce((sum, sale) => sum + (sale.amount_due || 0), 0)

  if (!loading && sales.length === 0) {
    return (
      <EmptyCard
        title={t("leads.sales.empty.title") || "No sales found"}
        description={t("leads.sales.empty.desc") || "This lead doesn't have any sales yet."}
        icon={<ShoppingCart className="h-12 w-12 text-muted-foreground" />}
      />
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className={documentListShellClassName()}>
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <DocumentListHead className="w-[38%]">{t("leads.sales.product") || "Product"}</DocumentListHead>
              <DocumentListHead className="w-[16%]">{t("leads.sales.status") || "Status"}</DocumentListHead>
              <DocumentListHead className="w-[22%]" align="right">{t("leads.sales.amount") || "Amount"}</DocumentListHead>
              <DocumentListHead className="w-[24%]" align="right">{t("leads.sales.actions") || "Actions"}</DocumentListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index} className="hover:bg-transparent">
                    <TableCell className="py-3.5">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5"><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell className="py-3.5"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                    <TableCell className="py-3.5">
                      <div className="flex justify-end gap-2">
                        <Skeleton className="h-8 w-8 rounded-md" />
                        <Skeleton className="h-8 w-8 rounded-md" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              : sales.map((sale) => {
                  const due = sale.amount_due || 0
                  const amount = sale.amount || 0
                  const cancelled = sale.status === "cancelled" || sale.status === "refunded"
                  const statusLabel = t(`sales.status.${sale.status}`) || sale.status
                  const dueLabel =
                    !cancelled && due > 0
                      ? `${formatCurrency(due, sale.currency || "USD")} ${t("sales.table.due") || "due"}`
                      : null
                  const paidLabel =
                    !cancelled && due <= 0
                      ? t("sales.table.paid") || "Paid"
                      : cancelled
                        ? statusLabel
                        : null

                  return (
                    <DocumentListRow
                      key={sale.id}
                      onClick={() => handleViewSale(sale)}
                      accent={documentRowAccent(sale.status, due)}
                    >
                      <TableCell className="py-3.5">
                        <EntityCell
                          name={sale.title || sale.productName || "Unnamed sale"}
                          secondary={sale.productName && sale.title ? sale.productName : null}
                          secondaryMono={false}
                          meta={formatDate(sale.saleDate)}
                        />
                      </TableCell>
                      <TableCell className="py-3.5">
                        <StatusDot status={sale.status} label={statusLabel} />
                      </TableCell>
                      <TableCell className="py-3.5">
                        <MoneyCell
                          amountLabel={formatCurrency(amount, sale.currency || "USD")}
                          dueLabel={dueLabel}
                          paidLabel={paidLabel}
                          cancelled={cancelled}
                          paidRatio={amount > 0 ? Math.max(0, (amount - due) / amount) : 1}
                        />
                      </TableCell>
                      <TableCell className="py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-0.5">
                          {due > 0 && !cancelled && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-amber-600 hover:text-amber-700 dark:text-amber-400"
                                  onClick={(e) => handleRegisterPayment(sale, e)}
                                >
                                  <CreditCard className="h-4 w-4" />
                                  <span className="sr-only">{t("sales.table.registerPayment") || "Register payment"}</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("sales.table.registerPayment") || "Register payment"}</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                onClick={(e) => handleSendSale(sale, e)}
                              >
                                <Send className="h-4 w-4" />
                                <span className="sr-only">{t("leads.sales.send") || "Send"}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("leads.sales.send") || "Send"}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 opacity-100 md:opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                                onClick={(e) => handlePrintSale(sale, e)}
                              >
                                <Printer className="h-4 w-4" />
                                <span className="sr-only">{t("sales.table.print") || "Print"}</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("sales.table.print") || "Print"}</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </DocumentListRow>
                  )
                })}
          </TableBody>
          {sales.length > 0 && (
            <tfoot>
              <tr className="bg-muted/30">
                <TableCell className="py-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  {t("sales.table.total") || "Total"}
                </TableCell>
                <TableCell />
                <TableCell className="py-3">
                  <MoneyCell
                    amountLabel={formatCurrency(totalAmount)}
                    dueLabel={
                      totalAmountDue > 0
                        ? `${formatCurrency(totalAmountDue)} ${t("sales.table.due") || "due"}`
                        : null
                    }
                  />
                </TableCell>
                <TableCell />
              </tr>
            </tfoot>
          )}
        </Table>
      </div>
    </TooltipProvider>
  )
}
