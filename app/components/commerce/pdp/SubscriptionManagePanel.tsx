"use client"

import { useState } from "react"
import { Button } from "@/app/components/ui/button"
import { useLocalization } from "@/app/context/LocalizationContext"
import { canCancelSubscription } from "@/app/buyer/subscription-utils"
import { cancelBuyerSubscription } from "@/app/buyer/actions"
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/app/components/ui/alert-dialog"
import { toast } from "sonner"
import { format } from "date-fns"
import { useRouter } from "next/navigation"

export function SubscriptionManagePanel({ subscription }: { subscription: any }) {
  const { t } = useLocalization()
  const router = useRouter()
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const res = await cancelBuyerSubscription(subscription.id)
      if (res.error) throw new Error(res.error)
      toast.success(t('buyer.subscriptions.cancelSuccess') || 'Subscription cancelled successfully')
      setShowCancelConfirm(false)
      router.refresh()
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel subscription')
    } finally {
      setIsCancelling(false)
    }
  }

  const isCancelled = subscription.status === 'cancelled' || subscription.status === 'expired'

  return (
    <div className="bg-card rounded-2xl border p-6 space-y-4 shadow-sm relative overflow-hidden">
      <h3 className="text-xl font-bold">{t('buyer.subscriptions.manage') || 'Manage Subscription'}</h3>
      
      <div className="space-y-1">
        <div className="text-sm text-muted-foreground">{t('buyer.subscriptions.table.status') || 'Status'}: <span className="font-medium text-foreground capitalize">{subscription.status}</span></div>
        {subscription.start_date && (
          <div className="text-sm text-muted-foreground">{t('buyer.subscriptions.startedPrefix') || 'Started'}: <span className="font-medium text-foreground">{format(new Date(subscription.start_date), 'MMM d, yyyy')}</span></div>
        )}
        {subscription.end_date && (
          <div className="text-sm text-muted-foreground">{t('buyer.subscriptions.endsPrefix') || 'Ends'}: <span className="font-medium text-foreground">{format(new Date(subscription.end_date), 'MMM d, yyyy')}</span></div>
        )}
      </div>

      {!isCancelled && (
        <div className="pt-2">
          {canCancelSubscription(subscription) ? (
            <Button 
              variant="destructive" 
              className="w-full sm:w-auto"
              onClick={() => setShowCancelConfirm(true)}
            >
              {t('buyer.subscriptions.cancelAction') || 'Cancel Subscription'}
            </Button>
          ) : (
            <div className="text-sm text-muted-foreground flex items-center bg-muted/50 p-3 rounded-lg border">
              {t('buyer.subscriptions.availableAfter') || 'Cancellation available after'} {format(new Date(subscription.end_date), 'MMM d, yyyy')}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('buyer.subscriptions.cancelConfirmTitle') || 'Cancel Subscription?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('buyer.subscriptions.cancelConfirmDesc') || 'Are you sure you want to cancel this subscription? You will lose access to its benefits.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>{t('buyer.subscriptions.keepButton') || 'Keep'}</AlertDialogCancel>
            <Button variant="destructive" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling ? '...' : (t('buyer.subscriptions.cancelButton') || 'Cancel')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
