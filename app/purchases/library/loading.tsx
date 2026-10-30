import { BuyerListSkeleton } from '@/app/buyer/components/BuyerListSkeleton'

export default function Loading() {
  return <div className="flex-1 flex flex-col min-h-[calc(100vh-var(--topbar-height,64px))] bg-muted/30">
    <BuyerListSkeleton kind="library" scope="site" />
  </div>
}