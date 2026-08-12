"use client";

import { useState } from "react";
import { Input } from "@/app/components/ui/input";
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
        <div className="flex items-center gap-1.5">
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={getTrans(
              "pos.cart.orderNotesPlaceholder",
              "Any special requests for this order?",
            )}
            className="bg-card h-9"
          />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-9 shrink-0 px-2.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border bg-card transition-colors"
          >
            {getTrans("details", "Details")}
          </button>
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
