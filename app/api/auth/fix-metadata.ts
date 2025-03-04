import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Database } from '@/lib/database.types'

export async function GET(request: Request) {
  const cookieStore = cookies()
  const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
  
  // Obtener la sesión actual
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  
  if (sessionError || !session) {
    return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })
  }
  
  try {
    // Actualizar los metadatos del usuario eliminando la imagen
    const { error } = await supabase.auth.updateUser({
      data: {
        // Eliminamos la imagen pero mantenemos otros datos
        picture: null,
        // Timestamp para forzar la actualización
        updated_at: new Date().toISOString()
      }
    })
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Metadatos del usuario limpiados correctamente. Inicia sesión nuevamente.' 
    })
  } catch (error) {
    console.error('Error al limpiar metadatos:', error)
    return NextResponse.json({ 
      error: 'Error al limpiar metadatos', 
      details: error 
    }, { status: 500 })
  }
} 