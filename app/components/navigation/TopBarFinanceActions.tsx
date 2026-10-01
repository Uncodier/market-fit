import { usePathname, useRouter } from "next/navigation";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { Button } from "../ui/button";
import { PlusCircle, ArrowUpRight, FileText } from "../ui/icons";
import type { TopBarActionsProps } from "./topbar-action-types";

type FinanceProps = Pick<TopBarActionsProps, "isAccountingPage" | "isFinancePage" | "isJournalEntriesPage">;

export function TopBarFinanceActions({ isAccountingPage, isFinancePage, isJournalEntriesPage }: FinanceProps) {
  const { currentSite } = useSite();
  const { t } = useLocalization();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <>
      {/* New Purchase button in toolbar */}
      {pathname.startsWith("/purchases/orders") && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => router.push(`/marketplace?ownerSiteId=${currentSite.id}&returnTo=/purchases/orders`)}
          title={t("buyer.orders.newPurchase") || "New Purchase"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline font-inter font-medium text-sm">
            {t("buyer.orders.newPurchase") || "New Purchase"}
          </span>
        </Button>
      )}

      {/* New Subscription button in toolbar */}
      {pathname.startsWith("/purchases/subscriptions") && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => router.push(`/marketplace?ownerSiteId=${currentSite.id}&returnTo=/purchases/subscriptions&filter=recurring`)}
          title={t("buyer.subscriptions.newSubscription") || "New Subscription"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline font-inter font-medium text-sm">
            {t("buyer.subscriptions.newSubscription") || "New Subscription"}
          </span>
        </Button>
      )}

      {/* Payouts actions */}
      {pathname.startsWith("/payments") && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => {
            const event = new CustomEvent("payouts:request-open")
            window.dispatchEvent(event)
          }}
          disabled={!currentSite.billing?.account_balance || currentSite.billing.account_balance <= 0}
          title="Request Payout"
        >
          <ArrowUpRight className="h-4 w-4" />
          <span className="hidden sm:inline">Request Payout</span>
        </Button>
      )}

      {/* New Bill button in toolbar */}
      {pathname.startsWith("/bills") && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => {
            if (pathname === "/bills") {
              window.dispatchEvent(new CustomEvent("bills:create"))
            } else {
              router.push("/bills")
              setTimeout(() => window.dispatchEvent(new CustomEvent("bills:create")), 100)
            }
          }}
          title={t("bills.create.button") || "New bill"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline font-inter font-medium text-sm">
            {t("bills.create.button") || "New bill"}
          </span>
        </Button>
      )}

      {/* Add Expense button in toolbar */}
      {pathname === "/transactions" && currentSite && (
        <Button
          size="default"
          className="flex items-center justify-center gap-2 transition-colors duration-200 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => {
            // Notify the page to open its creation dialog
            const event = new CustomEvent('transactions:create');
            window.dispatchEvent(event);
          }}
          title={t("expenses.create.button") || "Add Expense"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline font-inter font-medium text-sm">
            {t("expenses.create.button") || "Add Expense"}
          </span>
        </Button>
      )}

      {/* Accounting Actions */}
      {isAccountingPage && (
        <div className="flex items-center gap-2">
          <Button
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => window.dispatchEvent(new CustomEvent('accounting:create'))}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">Add Account</span>
          </Button>
        </div>
      )}

      {/* Finance Actions */}
      {isFinancePage && (
        <div className="flex items-center gap-2">
          <Button
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => window.dispatchEvent(new CustomEvent('finance:loadReport'))}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">Generate Report</span>
          </Button>
        </div>
      )}

      {/* Journal Entries Actions */}
      {isJournalEntriesPage && (
        <div className="flex items-center gap-2">
          <Button
            className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => window.dispatchEvent(new CustomEvent('journal:create'))}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">{t('accounting.newEntry') || "New Entry"}</span>
          </Button>
        </div>
      )}
    </>
  );
}
