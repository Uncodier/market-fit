"use client"

import { LoginButton } from "@/app/components/auth/login-button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card"
import { useAuthContext } from "@/app/components/auth/auth-provider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import Image from "next/image"

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuthContext()
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push("/")
    }
  }, [isAuthenticated, isLoading, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <Card className="w-[350px] shadow-xl">
        <CardHeader className="space-y-1 flex items-center justify-center">
          <div className="flex flex-col items-center mb-4">
            <Image 
              src="https://cloudfront.cdn.uncodie.com/zoDKXCi32aQHAee0dGmkjv/d8dcc649fecfe6d7d3c71901442818767d410b1d.png"
              alt="Market Fit Logo"
              width={64}
              height={64}
              className="mb-2"
            />
            <span className="text-[1.2rem] font-bold text-gray-900">
              MARKET FIT
            </span>
          </div>
          <CardTitle className="text-2xl text-center">Welcome</CardTitle>
          <CardDescription className="text-center">
            Sign in to access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="text-center text-sm text-muted-foreground">
            <p>
              We use Auth0 for secure and easy authentication
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center">
          <LoginButton className="w-auto" />
        </CardFooter>
      </Card>
    </div>
  )
} 