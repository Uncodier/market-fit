"use client";

import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";

export function PosOrderNotesDialog({
  open,
  onOpenChange,
  notes,
  onChange,
  t,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: string;
  onChange: (value: string) => void;
  t: (key: string) => string;
}) {
  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {getTrans("pos.cart.orderNotes", "Order notes")}
          </DialogTitle>
          <DialogDescription>
            {getTrans(
              "pos.cart.orderNotesDescription",
              "Special instructions for this order (kitchen, delivery, etc.).",
            )}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={notes}
          onChange={(e) => onChange(e.target.value)}
          placeholder={getTrans(
            "pos.cart.orderNotesPlaceholder",
            "Any special requests for this order?",
          )}
          className="min-h-[160px] resize-none"
          autoFocus
        />
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {getTrans("done", "Done")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
