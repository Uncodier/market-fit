import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          if (typeof document === 'undefined') return undefined
          return document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${name}=`))
            ?.split('=')[1]
        },
        set(name: string, value: string, options: { maxAge?: number; path?: string; domain?: string; secure?: boolean }) {
          if (typeof document === 'undefined') return
          let cookie = `${name}=${value}`
          if (options?.path) cookie += `; path=${options.path}`
          if (options?.maxAge) cookie += `; max-age=${options.maxAge}`
          if (options?.domain) cookie += `; domain=${options.domain}`
          if (options?.secure) cookie += `; secure`
          document.cookie = cookie
        },
        remove(name: string, options: { path?: string; domain?: string }) {
          if (typeof document === 'undefined') return
          let cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:01 GMT`
          if (options?.path) cookie += `; path=${options.path}`
          if (options?.domain) cookie += `; domain=${options.domain}`
          document.cookie = cookie
        }
      }
    }
  )
} 