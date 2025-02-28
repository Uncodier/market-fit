"use client"

import { AuthForm } from "@/app/components/auth/auth-form"
import { useSearchParams } from "next/navigation"
import Image from "next/image"

export default function AuthPage() {
  const searchParams = useSearchParams()
  const mode = searchParams.get("mode") === "register" ? "register" : "login"
  const returnTo = searchParams.get("returnTo")

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center space-y-4">
          <Image 
            src="https://cloudfront.cdn.uncodie.com/zoDKXCi32aQHAee0dGmkjv/d8dcc649fecfe6d7d3c71901442818767d410b1d.png"
            alt="Market Fit Logo"
            width={48}
            height={48}
            className="h-12 w-auto"
          />
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            {mode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}
          </h2>
          <p className="text-center text-sm text-gray-600">
            {mode === "login" 
              ? "Accede a tu cuenta para continuar" 
              : "Crea una cuenta para empezar"}
          </p>
        </div>

        <AuthForm mode={mode} returnTo={returnTo} />
      </div>
    </div>
  )
} 