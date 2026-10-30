"use client"

import { useRef, useState, useSyncExternalStore, type ChangeEvent, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { SearchInput } from "@/app/components/ui/search-input"
import { CommerceSearchInput } from "@/app/components/commerce/CommerceSearchInput"
import { StickyHeader } from "@/app/components/ui/sticky-header"
import { MobileShellSearchExpanded, MobileShellSearchIconButton } from "@/app/components/commerce/MobileShellSearch"

const SLOT_ID = "account-screen-search"

function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}
function snapshot() {
  return [SLOT_ID, `${SLOT_ID}-actions`, `${SLOT_ID}-expanded`]
    .filter(id => document.getElementById(id)).join(',')
}
function serverSnapshot() { return null }

/** Page-owned search state follows the active account screen into the shell. */
export function AccountSearch({ value, onChange, placeholder, scope = "personal", autoFocus = false }: {
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  placeholder: string
  scope?: "personal" | "site"
  autoFocus?: boolean
}) {
  useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const slot = typeof document === 'undefined' ? null : document.getElementById(SLOT_ID)
  const actions = typeof document === 'undefined' ? null : document.getElementById(`${SLOT_ID}-actions`)
  const expanded = typeof document === 'undefined' ? null : document.getElementById(`${SLOT_ID}-expanded`)
  const change = (next: string) => onChange({ target: { value: next } } as ChangeEvent<HTMLInputElement>)
  const close = (next: boolean) => {
    setOpen(next)
    if (!next) requestAnimationFrame(() => trigger.current?.focus())
  }
  if (scope === "site") return <SearchInput value={value} onChange={onChange} placeholder={placeholder} />
  return <>{slot ? createPortal(
    <CommerceSearchInput value={value} placeholder={placeholder} autoFocus={autoFocus}
      onChange={change} />,
    slot,
  ) : null}
    {actions ? createPortal(<MobileShellSearchIconButton ref={trigger} value={value} label={placeholder} onOpen={() => setOpen(true)} />, actions) : null}
    {expanded && open ? createPortal(
      <div className="absolute inset-0 z-20 flex md:hidden items-center gap-2 min-w-0 rounded-full bg-background px-3 py-2">
        <MobileShellSearchExpanded value={value} onChange={change} placeholder={placeholder} open={open} onOpenChange={close} />
      </div>, expanded,
    ) : null}
  </>
}

export function AccountSearchSlot() {
  return <>
    <div id={SLOT_ID} data-account-search className="hidden md:block absolute left-1/2 top-1/2 z-[15] w-2/5 -translate-x-1/2 -translate-y-1/2" />
    <div id={`${SLOT_ID}-expanded`} />
  </>
}

export function AccountSearchActionsSlot() {
  return <div id={`${SLOT_ID}-actions`} className="md:hidden empty:hidden" />
}

export function AccountSubheader({ scope, children }: { scope: "personal" | "site"; children: ReactNode }) {
  return scope === "site" ? <StickyHeader>{children}</StickyHeader>
    : <div data-account-subheader className="bg-transparent min-h-[72px] flex items-center">{children}</div>
}