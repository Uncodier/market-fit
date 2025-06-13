#!/usr/bin/env tsx

/**
 * Script para probar Magic Links de invitaciones de equipo
 * Uso: npm run test:magic-links
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

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Faltan variables de entorno de Supabase')
  console.log('Asegúrate de tener en tu .env.local:')
  console.log('- NEXT_PUBLIC_SUPABASE_URL')
  console.log('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// Cliente Supabase con service key para admin operations
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function testMagicLinkGeneration() {
  console.log('🧪 Probando sistema de invitaciones con usuarios existentes y nuevos...\n')

  // Datos de prueba
  const existingUserEmail = 'existing@example.com'
  const newUserEmail = 'newuser@example.com'
  const testSiteId = 'test-site-123'
  const testSiteName = 'Test Site'

  try {
    console.log('📧 Prueba 1: Verificando usuarios existentes')
    console.log(`Email objetivo: ${existingUserEmail}`)

    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers.users.find((u: any) => u.email === existingUserEmail)

    if (existingUser) {
      console.log('✅ Usuario existe, enviando Magic Link...')
      
      const invitationParams = new URLSearchParams({
        siteId: testSiteId,
        siteName: testSiteName,
        role: 'create',
        name: 'Existing User',
        position: 'Developer',
        type: 'team_invitation'
      })
      
      const redirectTo = `${APP_URL}/auth/team-invitation?${invitationParams.toString()}`

      const { data, error } = await supabase.auth.signInWithOtp({
        email: existingUserEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: redirectTo,
          data: {
            invitationType: 'team_invitation',
            siteId: testSiteId,
            siteName: testSiteName,
            role: 'create',
            name: 'Existing User',
            position: 'Developer'
          }
        }
      })

      if (error) {
        console.error('❌ Error enviando Magic Link:', error.message)
      } else {
        console.log('✅ Magic Link enviado correctamente')
      }
    } else {
      console.log('ℹ️ Usuario no existe, creando para la próxima prueba...')
      
      // Create user for testing
      const { error: createError } = await supabase.auth.admin.createUser({
        email: existingUserEmail,
        password: 'test-password-123',
        email_confirm: true
      })

      if (createError) {
        console.error('❌ Error creando usuario de prueba:', createError.message)
      } else {
        console.log('✅ Usuario de prueba creado')
      }
    }

    console.log('\n📧 Prueba 2: Invitación a usuario nuevo (Email Confirmation)')
    console.log(`Email destino: ${newUserEmail}`)

    // Check if new user exists (should not)
    const newUser = existingUsers.users.find((u: any) => u.email === newUserEmail)

    if (!newUser) {
      console.log('✅ Usuario no existe, creando cuenta y enviando confirmación...')
      
      const invitationParams = new URLSearchParams({
        siteId: testSiteId,
        siteName: testSiteName,
        role: 'view',
        name: 'New User',
        position: 'Designer',
        type: 'team_invitation'
      })
      
      const redirectTo = `${APP_URL}/auth/team-invitation?${invitationParams.toString()}`

      const { data, error } = await supabase.auth.signUp({
        email: newUserEmail,
        password: Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8),
        options: {
          emailRedirectTo: redirectTo,
          data: {
            invitationType: 'team_invitation',
            siteId: testSiteId,
            siteName: testSiteName,
            role: 'view',
            name: 'New User',
            position: 'Designer'
          }
        }
      })

      if (error) {
        console.error('❌ Error creando usuario y enviando confirmación:', error.message)
      } else {
        console.log('✅ Usuario creado y email de confirmación enviado')
        console.log('📝 El usuario recibirá un email de confirmación, no un magic link')
      }
    } else {
      console.log('ℹ️ Usuario ya existe, eliminando para prueba limpia...')
      
      await supabase.auth.admin.deleteUser(newUser.id)
      console.log('✅ Usuario eliminado para próxima prueba')
    }

    console.log('\n📬 Revisa los emails enviados:')
    console.log(`- ${existingUserEmail}: Debería recibir un Magic Link`)
    console.log(`- ${newUserEmail}: Debería recibir un Email de Confirmación`)
    console.log('\nAmbos tipos de email redirigirán al usuario a la página de invitación una vez procesados.')

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
  console.log('🚀 Test del Sistema de Invitaciones de Equipo\n')
  console.log('=' .repeat(60))

  // Verificar configuración
  const configOk = await checkSupabaseConfig()
  if (!configOk) {
    process.exit(1)
  }

  console.log('')

  // Probar sistema de invitaciones
  const testOk = await testMagicLinkGeneration()
  
  console.log('\n' + '=' .repeat(60))
  
  if (testOk) {
    console.log('✅ Tests completados!')
    console.log('\n📋 Comportamiento esperado:')
    console.log('1. Usuarios existentes reciben Magic Links (autenticación instantánea)')
    console.log('2. Usuarios nuevos reciben Email de Confirmación')
    console.log('3. Ambos son redirigidos a /auth/team-invitation después de autenticarse')
    console.log('4. La página procesa automáticamente la invitación y agrega al usuario al equipo')
    console.log('\n🔗 Próximo paso: Prueba haciendo clic en los enlaces de los emails')
  } else {
    console.log('❌ Tests fallaron. Revisa la configuración y vuelve a intentar.')
  }
}

// Ejecutar el script
main().catch(console.error) 