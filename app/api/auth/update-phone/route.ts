import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { userId, phone } = await request.json()

    if (!userId || !phone) {
      return NextResponse.json(
        { error: 'User ID and phone are required' },
        { status: 400 }
      )
    }

    // Service Role client for admin operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Para los nuevos usuarios, la validación se hace a través de Supabase Auth 
    // y si acabamos de hacer un sign up, no hay token todavía.
    // Vamos a usar la clave de servicio en el servidor sin checar el token si se provee la variable
    const authHeader = request.headers.get('Authorization')
    let isAuthorized = false;

    // First try standard auth
    if (authHeader) {
      const supabaseClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
      if (user && user.id === userId && !authError) {
        isAuthorized = true
      }
    }

    // If no token or invalid, allow if user was created < 15 minutes ago (for signups)
    if (!isAuthorized && !authHeader) {
      const { data: userRecord, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (userError || !userRecord || !userRecord.user) {
        return NextResponse.json({ error: 'User not found' }, { status: 401 })
      }
      const userCreatedAt = new Date(userRecord.user.created_at)
      const diffMinutes = (new Date().getTime() - userCreatedAt.getTime()) / (1000 * 60)
      if (diffMinutes <= 15) {
        isAuthorized = true
      } else {
        // In an "update user" case, the client will send the token. 
        // If not sent and not a new user, we reject the request.
        // But for testing:
        // isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized to update this user' }, { status: 401 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      phone: phone,
      phone_confirm: true, // Auto-confirm the phone to validate it
      user_metadata: { phone: phone }
    })

    if (error) {
      console.error('Error updating user phone via admin API:', error)
      // Si el teléfono ya ha sido tomado, podríamos decidir si fallamos o no
      // Por ahora retornaremos un 400 pero indicando que esto no debería bloquear 
      // la actualización de 'profiles'
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Actualizamos tambien los metadatos de usuario ya que a veces fallaba
    // Lo hacemos con fire-and-forget para no bloquear el retorno
    supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: { phone: phone }
    }).then(() => console.log('Metadata phone updated via admin'))
      .catch(metaError => console.error('Error updating metadata phone:', metaError));

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Unexpected error in update-phone route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
