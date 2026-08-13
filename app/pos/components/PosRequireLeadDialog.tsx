"use client";

import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import type { RelationSelectValue } from "@/app/components/ui/relation-select";
import { hasPosCustomer } from "@/app/pos/lead-utils";
import { PosCustomerSelect } from "./PosCustomerSelect";

export function PosRequireLeadDialog({
  open,
  onOpenChange,
  leads,
  siteId,
  t,
  oncePerUser = true,
  purpose = "promo",
  onConfirm,
  onLeadUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: any[];
  siteId?: string;
  t: (key: string) => string;
  oncePerUser?: boolean;
  purpose?: "promo" | "reservation";
  onConfirm: (value: RelationSelectValue) => void | Promise<void>;
  onLeadUpdated?: (lead: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  }) => void;
}) {
  const [draft, setDraft] = useState<RelationSelectValue>(null);
  const [confirming, setConfirming] = useState(false);
  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);

  useEffect(() => {
    if (open) {
      setDraft(null);
      setConfirming(false);
    }
  }, [open]);

  const canConfirm = hasPosCustomer(draft) && !confirming;

  const handleConfirm = async () => {
    if (!draft || !hasPosCustomer(draft)) return;
    setConfirming(true);
    try {
      await onConfirm(draft);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" busy={confirming}>
        <DialogHeader>
          <DialogTitle>
            {getTrans("pos.cart.requireLeadTitle", "Customer required")}
          </DialogTitle>
          <DialogDescription>
            {purpose === "reservation"
              ? getTrans(
                  "pos.cart.requireLeadReservation",
                  "Reservable services require a customer. Select or create a customer to continue.",
                )
              : oncePerUser
                ? getTrans(
                    "pos.cart.requireLeadOnce",
                    "This promotion can only be used once per customer. Select or create a customer to continue.",
                  )
                : getTrans(
                    "pos.cart.requireLeadLimited",
                    "This promotion is limited per customer. Select or create a customer to continue.",
                  )}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
        <PosCustomerSelect
          leads={leads}
          leadValue={draft}
          setLeadValue={setDraft}
          siteId={siteId}
          onLeadUpdated={onLeadUpdated}
          t={t}
          clearable={false}
          placeholder={getTrans("pos.cart.selectCustomer", "Select a customer")}
        />
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            {getTrans("cancel", "Cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
          >
            {getTrans("pos.cart.requireLeadConfirm", "Continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
