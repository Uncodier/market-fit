import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  console.log("🔍 DIAGNÓSTICO: Iniciando análisis de metadatos")
  
  try {
    const cookieStore = await cookies()
    const supabase = await createClient(true)
    
    console.log("🔍 DIAGNÓSTICO: Cliente Supabase creado")
    
    // Obtener la sesión actual
    const { data, error: sessionError } = await supabase.auth.getSession()
    const session = data?.session
    
    console.log("🔍 DIAGNÓSTICO: Sesión verificada", sessionError ? "ERROR" : session ? "ACTIVA" : "INACTIVA")
    
    // Información de cookies simplificada
    console.log("🔍 DIAGNÓSTICO: Intentando verificar cookies")
    let cookieNames: string[] = []
    try {
      // Uso del patrón async/await para manejar Promise<ReadonlyRequestCookies>
      cookieNames = cookieStore.getAll().map(cookie => cookie.name)
      console.log("🔍 DIAGNÓSTICO: Cookies disponibles:", cookieNames)
    } catch (cookieError) {
      console.error("🔍 DIAGNÓSTICO: Error al acceder a cookies", cookieError)
    }
    
    if (sessionError) {
      console.error("🔍 DIAGNÓSTICO ERROR:", sessionError)
      return NextResponse.json({ 
        error: 'Error al obtener la sesión', 
        details: sessionError.message,
        cookies: cookieNames
      }, { status: 500 })
    }
    
    if (!session) {
      console.log("🔍 DIAGNÓSTICO: No hay sesión activa")
      return NextResponse.json({ 
        error: 'No hay sesión activa',
        message: 'Por favor inicia sesión primero',
        cookies: cookieNames
      }, { status: 401 })
    }
    
    // Obtener usuario completo
    console.log("🔍 DIAGNÓSTICO: Obteniendo datos del usuario...")
    const { data: userData, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error("🔍 DIAGNÓSTICO ERROR:", userError)
      throw userError
    }
    
    console.log("🔍 DIAGNÓSTICO: Usuario encontrado", userData.user.id)
    console.log("🔍 DIAGNÓSTICO: Metadatos encontrados", Object.keys(userData.user.user_metadata || {}))
    
    // Extraer información segura para mostrar (sin tokens sensibles)
    const metadataKeys = Object.keys(userData.user.user_metadata || {})
    const metadataSizes = Object.entries(userData.user.user_metadata || {}).reduce((acc, [key, value]) => {
      let size = 0
      if (typeof value === 'string') {
        size = value.length
      } else {
        size = JSON.stringify(value).length
      }
      const sizeKB = Math.round(size / 1024)
      console.log(`🔍 DIAGNÓSTICO: Campo '${key}' tamaño aproximado ${sizeKB}KB`)
      return { ...acc, [key]: `${sizeKB}KB` }
    }, {} as Record<string, string>)
    
    const safeUserData = {
      id: userData.user.id,
      email: userData.user.email,
      // Metadatos completos para diagnóstico
      metadata: userData.user.user_metadata,
      // Lista de claves en los metadatos
      metadataKeys,
      // Tamaños aproximados de cada campo
      metadataSizes,
      // Fecha de última actualización
      lastUpdated: userData.user.updated_at
    }
    
    console.log("🔍 DIAGNÓSTICO: Análisis completado con éxito")
    return NextResponse.json({ 
      success: true, 
      user: safeUserData
    })
  } catch (error) {
    console.error("🔍 DIAGNÓSTICO ERROR CRÍTICO:", error)
    return NextResponse.json({ 
      error: 'Error al obtener metadatos', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 