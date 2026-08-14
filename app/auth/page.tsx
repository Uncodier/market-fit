import { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { AuthLandingClient } from "@/app/components/auth/AuthLandingClient"
import { createClient } from "@/lib/supabase/server"
import {
  hostnameFromRequestHeaders,
  isShopAuthContext,
  resolvePostAuthRedirect,
} from "@/lib/auth/post-auth-redirect"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }> | { returnTo?: string | string[] }
}): Promise<Metadata> {
  const params = await Promise.resolve(searchParams)
  const returnToRaw = params?.returnTo
  const returnTo = Array.isArray(returnToRaw) ? returnToRaw[0] : returnToRaw
  const shopAuth = isShopAuthContext(returnTo)

  return {
    title: "Sign In | Makinari",
    description: shopAuth
      ? "Sign in to view your orders and continue shopping."
      : "Sign in to your workspace.",
  }
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }> | { returnTo?: string | string[] }
}) {
  const params = await Promise.resolve(searchParams)
  const returnToRaw = params?.returnTo
  const returnTo = Array.isArray(returnToRaw) ? returnToRaw[0] : returnToRaw

  let user = null
  try {
    const supabase = await createClient()
    const result = await supabase.auth.getUser()
    if (!result.error) user = result.data.user
  } catch {
    // Invalid/expired session — stay on the sign-in page.
  }

  if (user) {
    const requestHeaders = await headers()
    redirect(
      resolvePostAuthRedirect(returnTo ?? null, hostnameFromRequestHeaders(requestHeaders))
    )
  }

  return <AuthLandingClient />
}
