'use client'

import { useEffect } from 'react'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Opcionalmente enviar el error a un servicio de registro
    console.error('Error global crítico:', error)
  }, [error])

  return (
    <html>
      <body>
        <div className="flex flex-col justify-center items-center h-screen bg-red-50">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-center text-red-600">Error Crítico</h2>
            <p className="mb-4 text-gray-600">
              Ha ocurrido un error crítico en la aplicación. Lamentamos los inconvenientes.
            </p>
            <div className="p-4 mb-4 bg-gray-100 rounded-md">
              <p className="text-sm text-gray-700 font-mono">
                {error.message || 'Error desconocido'}
              </p>
              {error.digest && (
                <p className="text-xs text-gray-500 mt-2 font-mono">ID: {error.digest}</p>
              )}
            </div>
            <div className="mt-4 flex justify-center">
              <button 
                onClick={reset}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 w-full"
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
} 