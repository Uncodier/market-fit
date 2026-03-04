import { Metadata } from "next"
import { AuthLandingClient } from "@/app/components/auth/AuthLandingClient"

export const metadata: Metadata = {
  title: "Sign In | Makinari",
  description: "Sign in to manage your AI sales agents and automate your revenue operations.",
}

export default function AuthPage() {
  return <AuthLandingClient />
}
