"use client";

import { useState } from "react";
import { Input } from "@/app/components/ui/input";
import { Button } from "@/app/components/ui/button";
import { PosOrderNotesDialog } from "./PosOrderNotesDialog";

export function PosOrderNotesField({
  notes,
  setNotes,
  t,
}: {
  notes: string;
  setNotes: (value: string) => void;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const getTrans = (key: string, fallback: string) =>
    t(key) === key ? fallback : t(key);

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {getTrans("pos.cart.orderNotes", "Order notes")}
        </label>
        <div className="relative">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={getTrans(
              "pos.cart.orderNotesPlaceholder",
              "Any special requests for this order?",
            )}
            className="bg-card h-9 pr-20"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
          >
            {getTrans("details", "Details")}
          </Button>
        </div>
      </div>

      <PosOrderNotesDialog
        open={open}
        onOpenChange={setOpen}
        notes={notes}
        onChange={setNotes}
        t={t}
      />
    </>
  );
}
