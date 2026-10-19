"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DialogBody, DialogFooter } from "@/app/components/ui/dialog";

const FooterTarget = createContext<HTMLDivElement | null | undefined>(undefined);
const ActionsVisible = createContext(true);

export function RegisterLayout({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null);

  return (
    <div data-slot="register-layout" className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <FooterTarget.Provider value={target}>
        <DialogBody>{children}</DialogBody>
        <DialogFooter>
          <div ref={setTarget} className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end" />
        </DialogFooter>
      </FooterTarget.Provider>
    </div>
  );
}

export function RegisterActionScope({ active, children }: { active: boolean; children: ReactNode }) {
  return <ActionsVisible.Provider value={active}>{children}</ActionsVisible.Provider>;
}

export function RegisterActions({ children }: { children: ReactNode }) {
  const target = useContext(FooterTarget);
  const visible = useContext(ActionsVisible);
  if (!visible) return null;
  // Standalone panels retain their actions without requiring a dialog layout.
  if (target === undefined) return <div className="flex flex-wrap justify-end gap-2">{children}</div>;
  return target ? createPortal(children, target) : null;
}