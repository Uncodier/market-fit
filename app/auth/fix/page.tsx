"use client"

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/database.types'

export default function FixUserPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [metadataBefore, setMetadataBefore] = useState<Record<string, any> | null>(null)
  const [metadataAfter, setMetadataAfter] = useState<Record<string, any> | null>(null)
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`])
    console.log(message)
  }
  
  const handleFix = async () => {
    if (isProcessing) return
    
    setIsProcessing(true)
    setError(null)
    
    try {
      addLog("Iniciando proceso de limpieza de metadatos...")
      const supabase = createClientComponentClient<Database>()
      
      // Verificar sesión
      addLog("Verificando sesión del usuario...")
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError) {
        throw new Error(`Error obteniendo sesión: ${sessionError.message}`)
      }
      
      if (!sessionData.session) {
        throw new Error("No hay sesión activa. Por favor inicia sesión para continuar.")
      }
      
      const userId = sessionData.session.user.id
      addLog(`Sesión activa para el usuario: ${userId}`)
      
      // Obtener datos actuales
      addLog("Obteniendo metadatos actuales...")
      const { data: userData, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        throw new Error(`Error obteniendo datos de usuario: ${userError.message}`)
      }
      
      // Guardar metadatos actuales
      const currentMetadata = userData.user.user_metadata || {}
      setMetadataBefore(currentMetadata)
      addLog(`Metadatos actuales: ${Object.keys(currentMetadata).length} campos`)
      
      // Crear metadatos limpios
      const essentialData = {
        // Solo preservamos estos campos básicos
        name: currentMetadata.name || null,
        email: userData.user.email,
        role: currentMetadata.role || null,
        language: currentMetadata.language || 'es',
        // Timestamp para forzar actualización
        updated_at: new Date().toISOString()
      }
      
      addLog("Limpiando metadatos, manteniendo solo datos esenciales...")
      
      // Actualizar con metadatos limpios
      const { error: updateError } = await supabase.auth.updateUser({
        data: essentialData
      })
      
      if (updateError) {
        throw new Error(`Error actualizando metadatos: ${updateError.message}`)
      }
      
      addLog("Metadatos limpiados correctamente")
      
      // Verificar resultado
      const { data: updatedUserData, error: verifyError } = await supabase.auth.getUser()
      
      if (verifyError) {
        throw new Error(`Error verificando actualización: ${verifyError.message}`)
      }
      
      const updatedMetadata = updatedUserData.user.user_metadata || {}
      setMetadataAfter(updatedMetadata)
      
      const preservedFields = Object.keys(essentialData)
      const removedFields = Object.keys(currentMetadata).filter(key => !preservedFields.includes(key))
      
      addLog(`Campos preservados: ${preservedFields.join(', ')}`)
      addLog(`Campos eliminados: ${removedFields.join(', ')}`)
      
      setIsSuccess(true)
      addLog("Proceso completado con éxito")
      
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Error desconocido'
      addLog(`ERROR: ${errorMessage}`)
      setError(errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }
  
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Limpiar Metadatos de Usuario</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Advertencia</h3>
        <p className="text-yellow-700 mb-4">
          Esta herramienta eliminará todos los metadatos de usuario excepto información esencial
          como nombre, email, rol e idioma. Esta acción no se puede deshacer.
        </p>
        
        {!isSuccess && (
          <button
            onClick={handleFix}
            disabled={isProcessing}
            className="px-5 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md font-medium disabled:opacity-50"
          >
            {isProcessing ? "Procesando..." : "Limpiar Metadatos"}
          </button>
        )}
        
        {isSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
            <p className="text-green-700 font-medium">
              ✅ Metadatos limpiados correctamente. Por favor cierra sesión y vuelve a iniciar.
            </p>
          </div>
        )}
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-4">
            <p className="text-red-700 font-medium">🚫 {error}</p>
          </div>
        )}
      </div>
      
      {metadataBefore && metadataAfter && (
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Metadatos Anteriores</h3>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(metadataBefore, null, 2)}
            </pre>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Metadatos Actuales</h3>
            <pre className="bg-gray-50 p-3 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(metadataAfter, null, 2)}
            </pre>
          </div>
        </div>
      )}
      
      <div className="bg-gray-800 text-gray-200 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-white">Logs</h3>
        <div className="bg-gray-900 p-3 rounded font-mono text-sm overflow-auto max-h-96">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
} 