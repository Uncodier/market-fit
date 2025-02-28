'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useEffect, useState } from 'react'

export default function UserStatus() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const getSession = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }

    getSession()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!user) return null

  return (
    <div className="flex items-center gap-4">
      <span>Hola, {user.email}</span>
      <button 
        onClick={() => supabase.auth.signOut()}
        className="px-4 py-2 bg-red-500 rounded hover:bg-red-600 text-white"
      >
        Cerrar Sesión
      </button>
    </div>
  )
} 