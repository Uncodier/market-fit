import { Metadata } from "next"
import { redirect } from "next/navigation"
import { AuthLandingClient } from "@/app/components/auth/AuthLandingClient"
import { createClient } from "@/lib/supabase/server"
import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect"

export const metadata: Metadata = {
  title: "Sign In | Makinari",
  description: "Sign in to manage your AI sales agents and automate your revenue operations.",
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }> | { returnTo?: string | string[] }
}) {
  const params = await Promise.resolve(searchParams)
  const returnToRaw = params?.returnTo
  const returnTo = Array.isArray(returnToRaw) ? returnToRaw[0] : returnToRaw

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect(resolvePostAuthRedirect(returnTo ?? null))
  }

  return <AuthLandingClient />
}
