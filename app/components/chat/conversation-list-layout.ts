import { stickyHeaderBorderClassName } from "@/app/components/ui/sticky-header-styles"

export const conversationSearchHeaderClassName = `flex h-[71px] shrink-0 items-center justify-center overflow-hidden w-full ${stickyHeaderBorderClassName}`
export const conversationSearchContentClassName = "relative w-full px-4 flex items-center justify-center min-w-0"
export const conversationFilterHeaderClassName = "flex h-[56px] shrink-0 justify-center overflow-hidden px-4 py-3 border-b dark:border-white/5 border-black/5 md:sticky md:top-0 md:z-[20]"

export const conversationRowLayout = {
  root: "box-border w-full text-left py-3 px-4 border-b dark:border-white/5 border-black/5",
  title: "flex min-h-5 items-center gap-2 mb-1 min-w-0",
  preview: "min-h-4",
  metadata: "flex min-h-4 justify-between items-center mt-0.5 gap-2 leading-4",
  details: "flex items-center gap-1 min-w-0 flex-1",
}