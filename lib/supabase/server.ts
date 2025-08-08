import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { Database } from "../database.types"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          cookieStore.set(name, value, options)
        },
        remove(name: string, options: any) {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )
}

// Cliente con permisos elevados (solo para operaciones del servidor)
export async function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return undefined; // No usar cookies del usuario para service client
        },
        set(name: string, value: string, options: any) {
          // No hacer nada para service client
        },
        remove(name: string, options: any) {
          // No hacer nada para service client
        },
      },
    }
  )
} 