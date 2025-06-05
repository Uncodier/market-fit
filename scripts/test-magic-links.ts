/**
 * Script para probar manualmente el sistema de Magic Links
 * 
 * Uso:
 * 1. Configura las variables de entorno
 * 2. Ejecuta: npx tsx scripts/test-magic-links.ts
 * 3. Sigue las instrucciones en consola
 */

import { createClient } from '@supabase/supabase-js'

// Configuración
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Faltan variables de entorno de Supabase')
  console.log('Asegúrate de tener configuradas:')
  console.log('- NEXT_PUBLIC_SUPABASE_URL')
  console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY')
  console.log('- NEXT_PUBLIC_APP_URL (opcional)')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function testMagicLinkGeneration() {
  console.log('🧪 Probando generación de Magic Links para invitaciones de equipo...\n')

  // Datos de prueba
  const testEmail = 'test@example.com'
  const testSiteId = 'test-site-123'
  const testSiteName = 'Test Site'

  try {
    // Crear URL de redirección con parámetros de invitación
    const invitationParams = new URLSearchParams({
      siteId: testSiteId,
      siteName: testSiteName,
      role: 'create',
      name: 'Test User',
      position: 'Developer',
      type: 'team_invitation'
    })
    
    const redirectTo = `${APP_URL}/auth/team-invitation?${invitationParams.toString()}`

    console.log('📧 Enviando Magic Link de prueba...')
    console.log(`Email destino: ${testEmail}`)
    console.log(`URL de redirección: ${redirectTo}`)

    // Generar Magic Link
    const { data, error } = await supabase.auth.signInWithOtp({
      email: testEmail,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: redirectTo,
        data: {
          invitationType: 'team_invitation',
          siteId: testSiteId,
          siteName: testSiteName,
          role: 'create',
          name: 'Test User',
          position: 'Developer',
          invitedBy: 'test-user-id',
          invitedByEmail: 'admin@test.com'
        }
      }
    })

    if (error) {
      console.error('❌ Error generando Magic Link:', error.message)
      
      if (error.message.includes('rate limit')) {
        console.log('\n💡 Tip: Has alcanzado el límite de rate limit de emails.')
        console.log('Espera unos minutos antes de probar de nuevo.')
      }
      
      if (error.message.includes('Invalid redirect URL')) {
        console.log('\n💡 Tip: Verifica que la URL de redirección esté configurada en Supabase:')
        console.log(`1. Ve a Authentication > URL Configuration en tu dashboard de Supabase`)
        console.log(`2. Agrega a "Redirect URLs": ${redirectTo}`)
      }
      
      return false
    }

    console.log('✅ Magic Link generado exitosamente!')
    
    if (data) {
      console.log('📝 Detalles de la respuesta:')
      console.log('- Message ID:', data.messageId || 'No disponible')
      console.log('- User:', (data as any).user?.email || 'Usuario no creado (correcto para invitaciones)')
    }

    console.log('\n📬 Revisa tu email para el Magic Link de invitación.')
    console.log('El link debería dirigirte a:', redirectTo)

    return true

  } catch (error) {
    console.error('❌ Error inesperado:', error)
    return false
  }
}

async function checkSupabaseConfig() {
  console.log('🔧 Verificando configuración de Supabase...\n')

  try {
    // Test básico de conexión
    const { data, error } = await supabase
      .from('sites')
      .select('count')
      .limit(1)

    if (error) {
      console.error('❌ Error conectando a Supabase:', error.message)
      return false
    }

    console.log('✅ Conexión a Supabase exitosa')
    return true

  } catch (error) {
    console.error('❌ Error de conexión:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Test de Magic Links para Invitaciones de Equipo\n')
  console.log('=' .repeat(50))

  // Verificar configuración
  const configOk = await checkSupabaseConfig()
  if (!configOk) {
    process.exit(1)
  }

  console.log('')

  // Probar generación de Magic Link
  const testOk = await testMagicLinkGeneration()
  
  console.log('\n' + '=' .repeat(50))
  
  if (testOk) {
    console.log('✅ Test completado exitosamente!')
    console.log('\n📋 Próximos pasos:')
    console.log('1. Revisa tu email por el Magic Link')
    console.log('2. Haz click en el link para probar el flujo completo')
    console.log('3. Verifica que la página /auth/team-invitation funcione correctamente')
  } else {
    console.log('❌ Test falló. Revisa la configuración y vuelve a intentar.')
  }
}

// Ejecutar el test
main().catch(console.error) 