"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import type { CatalogItem } from "@/app/types";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { ReservationSlotPicker } from "@/app/components/commerce/ReservationSlotPicker";
import { hasPosCustomer } from "@/app/pos/lead-utils";
import { PosCustomerSelect } from "./PosCustomerSelect";

export type PosReservationConfirm = {
  item: CatalogItem;
  reservationStart: string;
  reservationEnd: string;
  reservationAvailableQty?: number;
  leadValue: RelationSelectValue;
};

type Props = {
  item: CatalogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: PosReservationConfirm) => void | Promise<void>;
  leads: any[];
  siteId?: string;
  initialLeadValue?: RelationSelectValue | string | null;
  onLeadUpdated?: (lead: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  }) => void;
  t: (key: string) => string;
};

function toDraftLead(
  value: RelationSelectValue | string | null | undefined,
): RelationSelectValue {
  if (!hasPosCustomer(value) || !value) return null;
  if (typeof value === "string") {
    return { mode: "existing", id: value, label: value };
  }
  return value;
}

export function PosReservationDialog({
  item,
  open,
  onOpenChange,
  onConfirm,
  leads,
  siteId,
  initialLeadValue,
  onLeadUpdated,
  t,
}: Props) {
  const [draft, setDraft] = useState<RelationSelectValue>(null);
  const [slot, setSlot] = useState<{ start: string; end: string; available?: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);

  useEffect(() => {
    if (!open) return;
    setDraft(toDraftLead(initialLeadValue));
    setSlot(null);
    setConfirming(false);
    // Prefill from the cart customer only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const canConfirm =
    Boolean(item) && hasPosCustomer(draft) && Boolean(slot) && !confirming;

  const handleConfirm = async () => {
    if (!item || !slot || !hasPosCustomer(draft) || !draft) return;
    setConfirming(true);
    try {
      await onConfirm({
        item,
        reservationStart: slot.start,
        reservationEnd: slot.end,
        reservationAvailableQty: slot.available,
        leadValue: draft,
      });
      onOpenChange(false);
    } finally {
      setConfirming(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" busy={confirming}>
        <DialogHeader>
          <DialogTitle>
            {item.name} -{" "}
            {getTrans("pos.reservation.title", "Book service")}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-5">
          <div className="space-y-2">
            <Label>{getTrans("pos.reservation.customer", "Customer")}</Label>
            <PosCustomerSelect
              leads={leads}
              leadValue={draft}
              setLeadValue={setDraft}
              siteId={siteId}
              onLeadUpdated={onLeadUpdated}
              t={t}
              clearable={false}
              placeholder={getTrans(
                "pos.cart.selectCustomer",
                "Select a customer",
              )}
            />
          </div>

          <div className="space-y-2">
            <Label>{getTrans("pos.reservation.time", "Time slot")}</Label>
            <ReservationSlotPicker
              key={item.id}
              catalogItemId={item.id}
              layout="dialog"
              hideDetailsStep
              onSelect={(start, end, data) => setSlot({ start, end, available: data?.available })}
            />
            {slot ? (
              <p className="text-sm text-muted-foreground">
                {getTrans("pos.reservation.selected", "Selected")}:{" "}
                {format(new Date(slot.start), "PPP p")}
              </p>
            ) : null}
          </div>
        </DialogBody>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            {getTrans("common.cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
          >
            {getTrans("common.confirm", "Confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
