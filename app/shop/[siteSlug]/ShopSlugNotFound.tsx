import Link from "next/link"
import { Button } from "@/app/components/ui/button"
import * as Icons from "@/app/components/ui/icons"

export function ShopSlugNotFound({ slug }: { slug?: string }) {
  const slugLabel = slug?.trim()

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#fafafa] font-sans text-gray-900">
      <div className="text-center px-6 py-16 max-w-md">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Icons.Store className="text-gray-300" size={64} />
            <Icons.AlertCircle
              className="text-gray-900 absolute -bottom-1 -right-1"
              size={32}
            />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Shop not found</h1>
        <p className="text-muted-foreground mb-2">
          This shop link is invalid or the store is no longer available.
        </p>
        {slugLabel ? (
          <p className="text-sm text-muted-foreground mb-8 font-mono break-all">
            /shop/{slugLabel}
          </p>
        ) : (
          <div className="mb-8" />
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/marketplace">
              <Icons.Search className="mr-2 h-4 w-4" />
              Browse Marketplace
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Icons.Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
