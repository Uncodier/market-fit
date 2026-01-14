import { NavigationLink } from '@/app/components/navigation/NavigationLink'

export default function NotFound() {
  return (
    <div className="flex flex-col justify-center items-center h-[80vh]">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">Page Not Found</h2>
        <p className="mb-4 text-gray-600">
          Sorry, the page you are looking for doesn't exist or has been moved.
        </p>
        <div className="mt-4 flex justify-center">
          <NavigationLink 
            href="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full text-center"
          >
            Go to Dashboard
          </NavigationLink>
        </div>
      </div>
    </div>
  )
} 