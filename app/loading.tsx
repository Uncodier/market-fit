import { Loader } from './components/ui/icons'

export default function Loading() {
  return (
    <div className="flex flex-col justify-center items-center h-[80vh]">
      <Loader className="h-8 w-8 text-blue-500 mb-4" />
      <p className="text-sm text-gray-600">Loading...</p>
    </div>
  )
} 