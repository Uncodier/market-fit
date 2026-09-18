"use client"

import { Button } from "@/app/components/ui/button"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/app/components/ui/alert-dialog"
import {
  CreditCard,
  Link,
  Pencil,
  Printer,
  Send,
  Trash2,
} from "@/app/components/ui/icons"
import { Sale } from "@/app/types"
import { StatusBar } from "../../components/StatusBar"

type SaleDetailHeaderProps = {
  sale: Sale | null
  sending: boolean
  t: (key: string) => string
  onRegisterPayment: () => void
  onEdit: () => void
  onPrint: () => void
  onSend: () => void
  onCopyClientLink: () => void
  onPublish: () => void
  onUnpublish: () => void
  onDelete: () => void
  onStatusChange: (status: string) => void
}

export function SaleDetailHeader({
  sale,
  sending,
  t,
  onRegisterPayment,
  onEdit,
  onPrint,
  onSend,
  onCopyClientLink,
  onPublish,
  onUnpublish,
  onDelete,
  onStatusChange,
}: SaleDetailHeaderProps) {
  return (
    <StickyHeader>
      <div className="flex w-full flex-col">
        <div className="flex h-[50px] items-center justify-between px-4 md:px-16">
          <div className="flex items-center gap-1">
            {sale && sale.amount_due > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRegisterPayment}
                  className="flex items-center gap-1 text-green-600 hover:bg-green-50 hover:text-green-700"
                >
                  <CreditCard className="h-4 w-4" />
                  {t("sales.detail.registerPayment") || "Register Payment"}
                </Button>
                <div className="mx-1 h-6 w-px bg-border" />
              </>
            )}

            <Button variant="ghost" size="sm" onClick={onEdit} className="flex items-center gap-1">
              <Pencil className="h-4 w-4" />
              {t("common.edit") || "Edit"}
            </Button>
            <div className="mx-1 h-6 w-px bg-border" />

            <Button variant="ghost" size="sm" onClick={onPrint} className="flex items-center gap-1">
              <Printer className="h-4 w-4" />
              {t("common.print") || "Print"}
            </Button>
            <div className="mx-1 h-6 w-px bg-border" />

            {sale && sale.status !== "cancelled" && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onSend}
                  disabled={sending}
                  className="flex items-center gap-1"
                >
                  <Send className="h-4 w-4" />
                  {sale.lastEmailedAt
                    ? t("sales.detail.resendEmail") || "Resend"
                    : t("sales.detail.sendEmail") || "Send"}
                </Button>
                <div className="mx-1 h-6 w-px bg-border" />
              </>
            )}

            {sale && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCopyClientLink}
                  disabled={sending}
                  className="flex items-center gap-1"
                >
                  <Link className="h-4 w-4" />
                  {t("sales.detail.clientLink") || "Client Link"}
                </Button>
                <div className="mx-1 h-6 w-px bg-border" />
              </>
            )}

            {sale &&
              (sale.accountingState !== "posted" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onPublish}
                  className="flex items-center gap-1 text-primary hover:bg-primary/10"
                >
                  {t("common.publish") || "Publish"}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onUnpublish}
                  className="flex items-center gap-1 text-orange-600 hover:bg-orange-50"
                >
                  {t("common.cancel") || "Cancel"}
                </Button>
              ))}

            <div className="mx-1 h-6 w-px bg-border" />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("common.delete") || "Delete"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("sales.detail.deleteTitle") || "Delete Sale"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("sales.detail.deleteConfirm") ||
                      "Are you sure you want to delete this sale? This action cannot be undone."}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel") || "Cancel"}</AlertDialogCancel>
                  <AlertDialogAction
                    className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
                    onClick={onDelete}
                  >
                    {t("common.delete") || "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex items-center justify-end">
            {sale && (
              <StatusBar
                currentStatus={sale.status}
                onStatusChange={onStatusChange}
              />
            )}
          </div>
        </div>
      </div>
    </StickyHeader>
  )
}
