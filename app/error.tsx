'use client'

import { useEffect } from 'react'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log the error to the console
  useEffect(() => {
    console.error('Error en la aplicación:', error)
    
    // Log detallado para problemas de autenticación
    if (error.message.includes('token') || error.message.includes('auth')) {
      console.error('Posible problema de autenticación. Intenta cerrar sesión y volver a iniciar sesión.')
    }
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-red-600">Se ha producido un error</CardTitle>
          <CardDescription>
            Ha ocurrido un problema inesperado en la aplicación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-red-50 border border-red-100 rounded-md mb-4">
            <p className="text-sm font-medium text-red-800">Detalles del error:</p>
            <p className="text-sm text-red-700 mt-1 break-words">
              {error.message || "Error desconocido"}
            </p>
            {error.digest && (
              <p className="text-xs text-red-500 mt-2">
                ID del error: {error.digest}
              </p>
            )}
          </div>
          <p className="text-sm text-gray-500">
            Puedes intentar:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-500 mt-2 space-y-1">
            <li>Recargar la página</li>
            <li>Limpiar la caché del navegador</li>
            <li>Cerrar sesión y volver a iniciar sesión</li>
            <li>Volver a la página de inicio</li>
          </ul>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/auth/login'}
          >
            Ir al inicio de sesión
          </Button>
          <Button onClick={reset}>
            Intentar de nuevo
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 