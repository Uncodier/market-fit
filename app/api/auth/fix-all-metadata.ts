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
    // Obtener datos actuales del usuario para preservar solo lo esencial
    const { data: userData, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      throw userError
    }
    
    // Extraer solo los campos esenciales que queremos preservar
    const currentMetadata = userData.user.user_metadata || {}
    const essentialData = {
      // Solo preservamos estos campos básicos, todo lo demás se elimina
      name: currentMetadata.name || null,
      email: userData.user.email,
      role: currentMetadata.role || null,
      language: currentMetadata.language || 'es',
      // Timestamp para forzar actualización
      updated_at: new Date().toISOString()
    }
    
    // Actualizamos con metadatos mínimos
    const { error } = await supabase.auth.updateUser({
      data: essentialData
    })
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Todos los metadatos del usuario han sido reiniciados correctamente. Cierra sesión y vuelve a iniciar.',
      preserved: Object.keys(essentialData),
      removed: Object.keys(currentMetadata).filter(key => !Object.keys(essentialData).includes(key))
    })
  } catch (error) {
    console.error('Error al reiniciar metadatos:', error)
    return NextResponse.json({ 
      error: 'Error al reiniciar metadatos', 
      details: error 
    }, { status: 500 })
  }
} 