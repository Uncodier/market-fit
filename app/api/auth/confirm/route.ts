import { type EmailOtpType } from '@supabase/supabase-js'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null
    const next = searchParams.get('next') ?? '/'

    if (!token_hash || !type) {
      console.error('Faltan parámetros requeridos:', { token_hash, type })
      return NextResponse.redirect(
        `${new URL(request.url).origin}/auth/login?error=missing_confirmation_params`
      )
    }

    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (error) {
      console.error('Error verificando OTP:', error)
      return NextResponse.redirect(
        `${new URL(request.url).origin}/auth/login?error=verification_failed&message=${encodeURIComponent(error.message)}`
      )
    }

    // Verificar que el usuario esté autenticado después de la verificación
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Error obteniendo usuario después de la verificación:', userError)
      return NextResponse.redirect(
        `${new URL(request.url).origin}/auth/login?error=verification_failed&message=user_not_found`
      )
    }

    // Redirigir al usuario a la página especificada o al inicio
    return NextResponse.redirect(new URL(next, request.url))
  } catch (error: any) {
    console.error('Error en la confirmación de email:', error)
    return NextResponse.redirect(
      `${new URL(request.url).origin}/auth/login?error=confirmation_error&message=${encodeURIComponent(error.message || 'Unknown error')}`
    )
  }
} 