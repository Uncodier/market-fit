import { usePathname } from "next/navigation";
import { useSite } from "@/app/context/SiteContext";
import { useLocalization } from "@/app/context/LocalizationContext";
import { Button } from "../ui/button";
import { PlusCircle } from "../ui/icons";
import { CreateDealDialog } from "@/app/deals/components/CreateDealDialog";
import { CreateQuotationDialog } from "@/app/quotations/components/CreateQuotationDialog";
import { handleCreateDeal } from "./topbar-create-handlers";
import type { TopBarActionsProps } from "./topbar-action-types";

type CommerceProps = Pick<TopBarActionsProps,
  "isRecordsPage" | "isSalesPage" | "isDealsPage" | "isQuotationsPage" | "onCreateSale" | "priceListData"
>;

export function TopBarCommerceActions({
  isRecordsPage, isSalesPage, isDealsPage, isQuotationsPage, onCreateSale, priceListData,
}: CommerceProps) {
  const { currentSite } = useSite();
  const { t } = useLocalization();
  const pathname = usePathname();
  return (
    <>
      {isRecordsPage && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("records:create"))
          }
          title={t("layout.topbar.newRecord") || "New Record"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">
            {t("layout.topbar.newRecord") || "New Record"}
          </span>
        </Button>
      )}

      {isSalesPage &&
        (currentSite ? (
          <>
            <Button
              onClick={onCreateSale}
              className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
              title={t("layout.topbar.addSale")}
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline ml-2">
                {t("layout.topbar.addSale")}
              </span>
            </Button>
          </>
        ) : null)}

      {pathname === "/catalog" && currentSite && (
        <div className="flex items-center gap-2">
          <Button
            className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("catalog:create"))
            }
            title={t("catalog.addItem") || "Add Item"}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">
              {t("catalog.addItem") || "Add Item"}
            </span>
          </Button>
        </div>
      )}

      {pathname === "/catalog/modifier-groups" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("modifier-groups:create"))
          }
          title={t("catalog.modifiers.create") || "New group"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">
            {t("catalog.modifiers.create") || "New group"}
          </span>
        </Button>
      )}

      {pathname === "/orders" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() => window.dispatchEvent(new CustomEvent("orders:create"))}
          title={t("orders.add") || "Create Order"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">
            {t("orders.add") || "Create Order"}
          </span>
        </Button>
      )}

      {pathname === "/shipments" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("shipments:create"))
          }
          title={t("shipments.add") || "Create Shipment"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">
            {t("shipments.add") || "Create Shipment"}
          </span>
        </Button>
      )}

      {pathname === "/inventory" && currentSite && (
        <div className="flex items-center gap-2">
          <Button
            className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("inventory:create-stock"))
            }
            title={t("inventory.addStock") || "Add Stock"}
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">
              {t("inventory.addStock") || "Add Stock"}
            </span>
          </Button>
        </div>
      )}

      {pathname === "/price-lists" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("price-lists:create"))
          }
          title={t("priceLists.addList") || "Create List"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">
            {t("priceLists.addList") || "Create List"}
          </span>
        </Button>
      )}

      {pathname.startsWith("/price-lists/") && pathname !== "/price-lists" && currentSite && priceListData && (
        <div className="flex items-center gap-4">
          <Button
            className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("price-list:add-price"))
            }
            title="Add Price"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">
              Add Price
            </span>
          </Button>
        </div>
      )}

      {pathname === "/promotions" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("promotions:create"))
          }
          title={t("promotions.add") || "Create Promotion"}
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">
            {t("promotions.add") || "Create Promotion"}
          </span>
        </Button>
      )}

      {pathname === "/subscriptions" && currentSite && (
        <Button
          className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
          onClick={() =>
            window.dispatchEvent(new CustomEvent("subscriptions:create"))
          }
          title="Create Subscription"
        >
          <PlusCircle className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline ml-2">Create Subscription</span>
        </Button>
      )}

      {pathname === "/reservations" && currentSite && (
        <div className="flex gap-2">
          <Button
            className="!min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("reservations:create"))
            }
            title="Create Reservation"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-2">Create Reservation</span>
          </Button>
        </div>
      )}

      {isQuotationsPage && pathname === "/quotations" && currentSite && (
        <CreateQuotationDialog
          trigger={
            <Button
              className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
              title="Create Quotation"
            >
              <PlusCircle className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline ml-2">Create Quotation</span>
            </Button>
          }
        />
      )}
      {isDealsPage &&
        (currentSite ? (
          <CreateDealDialog
            onCreateDeal={handleCreateDeal}
            trigger={
              <Button
                className="flex items-center justify-center gap-2 !min-w-0 sm:!min-w-[155px] md:!min-w-[200px] sm:!px-3.5 !w-9 sm:!w-auto !h-9 sm:!aspect-auto !aspect-square !p-0 rounded-full font-inter font-medium text-sm"
                title={t("layout.topbar.createDeal")}
              >
                <PlusCircle className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline ml-2">
                  {t("layout.topbar.createDeal")}
                </span>
              </Button>
            }
          />
        ) : null)}
    </>
  );
}
