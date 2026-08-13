"use client";

import { useState } from "react";
import { Input } from "@/app/components/ui/input";
import { FileText } from "@/app/components/ui/icons";
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
      <div className="relative">
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={getTrans("pos.cart.orderNotes", "Order notes")}
          icon={<FileText className="h-4 w-4" />}
          className="bg-card pr-20"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-7 px-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
