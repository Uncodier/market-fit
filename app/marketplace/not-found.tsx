import Link from "next/link"
import { Button } from "@/app/components/ui/button"
import { Home, Search } from "@/app/components/ui/icons"

export default function MarketplaceNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold tracking-tight">Marketplace item not found</h1>
        <p className="mt-3 text-muted-foreground">
          This marketplace link is invalid or the item is no longer available.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/marketplace">
              <Search className="mr-2 h-4 w-4" />
              Browse Marketplace
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
