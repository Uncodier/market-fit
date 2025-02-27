import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col justify-center items-center h-[80vh]">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Página no encontrada</h2>
        <p className="mb-4 text-gray-600">
          Lo sentimos, la página que estás buscando no existe o ha sido movida.
        </p>
        <div className="mt-4 flex justify-center">
          <Link 
            href="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full text-center"
          >
            Ir al Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
} 