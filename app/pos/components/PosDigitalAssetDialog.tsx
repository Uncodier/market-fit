"use client";

import { useEffect, useState } from "react";
import type { CatalogItem } from "@/app/types";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { toast } from "sonner";
import {
  BuyerUserEmailField,
  type BuyerUser,
} from "@/app/components/commerce/BuyerUserEmailField";
import type { PosCartModifier } from "./CartPanel";

export type PosDigitalAssetConfirm = {
  item: CatalogItem;
  buyerUser: BuyerUser;
  modifiers: PosCartModifier[];
};

type Props = {
  item: CatalogItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: PosDigitalAssetConfirm) => void | Promise<void>;
  modifiers?: PosCartModifier[];
  initialBuyerUser?: BuyerUser | null;
  t: (key: string) => string;
};

export function PosDigitalAssetDialog({
  item,
  open,
  onOpenChange,
  onConfirm,
  modifiers = [],
  initialBuyerUser = null,
  t,
}: Props) {
  const [buyerUser, setBuyerUser] = useState<BuyerUser | null>(null);
  const [confirming, setConfirming] = useState(false);
  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);

  useEffect(() => {
    if (!open) return;
    setBuyerUser(initialBuyerUser);
    setConfirming(false);
    // Prefill from the cart buyer only when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  const canConfirm = Boolean(item) && Boolean(buyerUser) && !confirming;

  const handleConfirm = async () => {
    if (!item || !buyerUser) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error(
        t("pos.sync.requiresOnline") ||
          "This action requires an internet connection",
      );
      return;
    }
    setConfirming(true);
    try {
      await onConfirm({ item, buyerUser, modifiers });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign buyer");
    } finally {
      setConfirming(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" busy={confirming}>
        <DialogHeader>
          <DialogTitle>
            {item.name} -{" "}
            {getTrans("pos.digital.title", "Assign buyer")}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {getTrans(
              "pos.digital.description",
              "Look up the platform user who should receive this asset.",
            )}
          </p>
          <BuyerUserEmailField
            value={buyerUser}
            onChange={setBuyerUser}
            disabled={confirming}
            required
          />
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
