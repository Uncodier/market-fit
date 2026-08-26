export const overlayZClassName = "z-[1000000]"
export const dialogContentZClassName = "z-[1000001]"
/** Portaled menus/selects/popovers must sit above dialog content. */
export const floatingLayerZClassName = "z-[1000050]"

export const overlayClassName =
  "fixed inset-0 z-[1000000] bg-black/40 dark:bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"

export const DIALOG_SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const

export type DialogSize = keyof typeof DIALOG_SIZES

export function dialogSizeClassName(size: DialogSize = "md"): string {
  return DIALOG_SIZES[size]
}

/** Outer scroll is a fallback. Slotted body/form must own scrolling or the footer sits in extra space. */
export const dialogContentOverflowClassName =
  "overflow-y-auto [&:has([data-slot=dialog-form])]:overflow-hidden [&:has([data-slot=dialog-body])]:overflow-hidden"

const FLOATING_LAYER_SELECTOR = [
  "[data-radix-popper-content-wrapper]",
  "[data-radix-select-content]",
  "[data-radix-menu-content]",
  "[role='listbox']",
].join(",")

export function isDismissEventFromFloatingLayer(
  target: EventTarget | null
): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest(FLOATING_LAYER_SELECTOR))
}

export function preventDismissFromFloatingLayer(event: {
  target: EventTarget | null
  preventDefault: () => void
}): boolean {
  if (!isDismissEventFromFloatingLayer(event.target)) return false
  event.preventDefault()
  return true
}
