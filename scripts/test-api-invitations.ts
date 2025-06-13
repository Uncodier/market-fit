#!/usr/bin/env tsx

/**
 * Script para probar la API de invitaciones de equipo
 * Uso: npm run test:api-invitations
 */

import { createClient } from '@supabase/supabase-js'

// Cargar variables de entorno manualmente
const fs = require('fs')
const path = require('path')

// Read .env.local file
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  envContent.split('\n').forEach((line: string) => {
    if (line.trim() && !line.startsWith('#')) {
      const [key, value] = line.split('=')
      if (key && value) {
        process.env[key.trim()] = value.trim()
      }
    }
  })
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const API_URL = `${APP_URL}/api/team/invite-member`

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno de Supabase')
  console.log('Asegúrate de tener en tu .env.local:')
  console.log('- NEXT_PUBLIC_SUPABASE_URL')
  console.log('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Cliente Supabase con service key para admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testInvitationAPI() {
  console.log('🧪 Probando API de invitaciones de equipo...\n')

  // Datos de prueba
  const testEmails = ['existing@example.com', 'newuser@example.com']
  const testSiteId = 'test-site-123'
  const testSiteName = 'Test Site'

  try {
    // Crear un usuario de prueba y un sitio de prueba para los tests
    console.log('🔧 Configurando datos de prueba...')
    
    // Crear usuario de prueba
    const testUserEmail = 'testowner@example.com'
    const { data: testUser, error: userError } = await supabase.auth.admin.createUser({
      email: testUserEmail,
      password: 'test-password-123',
      email_confirm: true
    })

    if (userError && !userError.message.includes('already registered')) {
      console.error('❌ Error creando usuario de prueba:', userError.message)
      return false
    }

    const userId = testUser?.user?.id || 'existing-user-id'
    
    // Crear sitio de prueba
    const { data: siteData, error: siteError } = await supabase
      .from('sites')
      .upsert({
        id: testSiteId,
        name: testSiteName,
        user_id: userId,
        url: 'https://test-site.com'
      }, { onConflict: 'id' })
      .select()
      .single()

    if (siteError) {
      console.warn('⚠️ No se pudo crear sitio de prueba:', siteError.message)
    } else {
      console.log('✅ Sitio de prueba configurado')
    }

    console.log('✅ Datos de prueba configurados\n')

    // Test de la API de invitaciones
    for (const email of testEmails) {
      console.log(`📧 Probando invitación para: ${email}`)
      
      const invitationData = {
        email,
        siteId: testSiteId,
        siteName: testSiteName,
        role: 'view',
        name: `Test User ${email.split('@')[0]}`,
        position: 'Tester'
      }

      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // En un test real, necesitarías autenticación válida
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
          },
          body: JSON.stringify(invitationData)
        })

        const result = await response.json()

        if (response.ok) {
          console.log(`✅ Invitación enviada exitosamente a ${email}`)
          console.log(`   Mensaje: ${result.message}`)
        } else {
          console.log(`⚠️ Error en invitación para ${email}: ${result.error}`)
        }

      } catch (fetchError) {
        console.error(`❌ Error de red para ${email}:`, fetchError)
      }

      console.log('')
    }

    // Limpieza
    console.log('🧹 Limpiando datos de prueba...')
    
    // Eliminar sitio de prueba
    await supabase.from('sites').delete().eq('id', testSiteId)
    
    // Eliminar usuarios de prueba (si fueron creados)
    if (testUser?.user?.id) {
      await supabase.auth.admin.deleteUser(testUser.user.id)
    }

    console.log('✅ Limpieza completada')

    return true

  } catch (error) {
    console.error('❌ Error inesperado:', error)
    return false
  }
}

async function checkAPIEndpoint() {
  console.log('🔧 Verificando endpoint de API...\n')

  try {
    // Test básico de ping al endpoint
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}) // Datos inválidos para probar la validación
    })

    if (response.status === 400) {
      console.log('✅ Endpoint de API responde correctamente (validación funcionando)')
      return true
    } else {
      console.log(`⚠️ Endpoint responde con status inesperado: ${response.status}`)
      return false
    }

  } catch (error) {
    console.error('❌ Error conectando al endpoint:', error)
    return false
  }
}

async function main() {
  console.log('🚀 Test de API de Invitaciones de Equipo\n')
  console.log('=' .repeat(60))

  // Verificar endpoint
  const endpointOk = await checkAPIEndpoint()
  if (!endpointOk) {
    console.log('\n❌ El endpoint de API no está disponible.')
    console.log('Asegúrate de que el servidor de desarrollo esté ejecutándose:')
    console.log('npm run dev')
    process.exit(1)
  }

  console.log('')

  // Probar API de invitaciones
  const testOk = await testInvitationAPI()
  
  console.log('\n' + '=' .repeat(60))
  
  if (testOk) {
    console.log('✅ Tests de API completados!')
    console.log('\n📋 Lo que se probó:')
    console.log('1. Endpoint de API responde correctamente')
    console.log('2. Validación de datos de entrada')
    console.log('3. Envío de invitaciones para diferentes tipos de usuarios')
    console.log('\n📬 Revisa los emails enviados para verificar el funcionamiento completo')
  } else {
    console.log('❌ Tests fallaron. Revisa los logs para más detalles.')
  }
}

// Ejecutar el script
main().catch(console.error) 