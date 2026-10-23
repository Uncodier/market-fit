"use client";

import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { Button } from "@/app/components/ui/button";
import { Banknote } from "@/app/components/ui/icons";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/app/components/ui/dialog";

export interface CashRegisterOptionsProps {
  siteId?: string;
  locationId: string;
  onLocationChange?: (id: string) => void;
  locations: { id: string; name?: string | null }[];
  currency: string;
  onOpened?: () => void;
}

const RegisterDashboard = lazy(() => import("./RegisterDashboard"));

class RegisterLoadBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <DialogBody><p role="alert">Cash register could not load. Close and reopen this dialog, or reload the page.</p></DialogBody>
      : this.props.children;
  }
}

export function CashRegisterOptions(props: CashRegisterOptionsProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" className="w-full">
          <Banknote className="mr-2 h-4 w-4" />Cash Register
        </Button>
      </DialogTrigger>
      {open && <CashRegisterContent {...props} />}
    </Dialog>
  );
}

/** Mounted within the payment dialog so Radix owns nested focus and dismissal. */
export function PaymentCashRegisterDialog({ open, onOpenChange, ...props }: CashRegisterOptionsProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <CashRegisterContent {...props} onOpened={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function CashRegisterContent(props: CashRegisterOptionsProps) {
  return (
    <DialogContent size="lg">
      <DialogHeader>
        <DialogTitle>Cash Register</DialogTitle>
        <DialogDescription>{props.onOpened ? "Open a register to continue. Your payment details will be preserved; confirm the payment after opening." : "Open, reconcile and review the register for a location. Register writes require an internet connection."}</DialogDescription>
      </DialogHeader>
      <RegisterLoadBoundary>
        <Suspense fallback={<DialogBody><p role="status">Loading cash register…</p></DialogBody>}>
          <RegisterDashboard key={`${props.siteId}:${props.locationId}`} {...props} />
        </Suspense>
      </RegisterLoadBoundary>
    </DialogContent>
  );
}