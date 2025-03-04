"use client"

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/database.types'

export default function DiagnosePage() {
  const [userData, setUserData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`])
  }
  
  useEffect(() => {
    const diagnoseUser = async () => {
      try {
        addLog("Iniciando diagnóstico de usuario")
        const supabase = createClientComponentClient<Database>()
        
        // Verificar sesión
        addLog("Verificando sesión...")
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          throw new Error(`Error obteniendo sesión: ${sessionError.message}`)
        }
        
        if (!sessionData.session) {
          throw new Error("No hay sesión activa. Por favor inicia sesión para continuar.")
        }
        
        addLog(`Sesión activa para el usuario: ${sessionData.session.user.id}`)
        
        // Obtener datos de usuario
        addLog("Obteniendo datos completos del usuario...")
        const { data: userResult, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          throw new Error(`Error obteniendo datos de usuario: ${userError.message}`)
        }
        
        // Analizar metadatos
        const metadata = userResult.user.user_metadata || {}
        addLog(`Metadatos encontrados con ${Object.keys(metadata).length} campos`)
        
        // Calcular tamaños
        const metadataSizes: Record<string, string> = {}
        let totalSize = 0
        
        Object.entries(metadata).forEach(([key, value]) => {
          let size = 0
          if (typeof value === 'string') {
            size = value.length
          } else {
            size = JSON.stringify(value).length
          }
          totalSize += size
          metadataSizes[key] = `${(size / 1024).toFixed(2)} KB`
          addLog(`Campo '${key}' tiene un tamaño aproximado de ${(size / 1024).toFixed(2)} KB`)
        })
        
        addLog(`Tamaño total de metadatos: ${(totalSize / 1024).toFixed(2)} KB`)
        
        // Preparar datos para mostrar
        setUserData({
          id: userResult.user.id,
          email: userResult.user.email,
          metadataKeys: Object.keys(metadata),
          metadataSizes,
          totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
          metadata
        })
        
        addLog("Diagnóstico completado con éxito")
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Error desconocido'
        addLog(`ERROR: ${errorMessage}`)
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }
    
    diagnoseUser()
  }, [])
  
  const renderContent = () => {
    if (isLoading) {
      return <div className="text-center p-8">Cargando información de usuario...</div>
    }
    
    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )
    }
    
    if (!userData) {
      return <div>No se pudo cargar información del usuario</div>
    }
    
    return (
      <div className="space-y-8">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Información del Usuario</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-gray-600">ID:</div>
            <div>{userData.id}</div>
            <div className="text-gray-600">Email:</div>
            <div>{userData.email}</div>
          </div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Metadatos del Usuario</h3>
          <p className="mb-4">Tamaño total aproximado: <strong>{userData.totalSize}</strong></p>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-200 p-2 text-left">Campo</th>
                  <th className="border border-gray-200 p-2 text-left">Tamaño</th>
                  <th className="border border-gray-200 p-2 text-left">Valor</th>
                </tr>
              </thead>
              <tbody>
                {userData.metadataKeys.map((key: string) => (
                  <tr key={key} className="border-b border-gray-200">
                    <td className="border border-gray-200 p-2 font-medium">{key}</td>
                    <td className="border border-gray-200 p-2">{userData.metadataSizes[key]}</td>
                    <td className="border border-gray-200 p-2 break-all">
                      {typeof userData.metadata[key] === 'object' 
                        ? JSON.stringify(userData.metadata[key], null, 2) 
                        : String(userData.metadata[key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Diagnóstico de Usuario</h1>
      
      {renderContent()}
      
      <div className="mt-8 bg-gray-800 text-gray-200 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-white">Logs de Diagnóstico</h3>
        <div className="bg-gray-900 p-3 rounded font-mono text-sm overflow-auto max-h-96">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
} 