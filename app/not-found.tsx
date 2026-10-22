'use client'

import { NavigationLink } from '@/app/components/navigation/NavigationLink'
import { useLocalization } from '@/app/context/LocalizationContext'

export default function NotFound() {
  const { t } = useLocalization()
  return (
    <div className="flex flex-col justify-center items-center h-[80vh]">
      <div className="bg-white p-8 rounded-lg shadow-xl max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-center text-gray-800">{t('system.notFound.title')}</h2>
        <p className="mb-4 text-gray-600">
          {t('system.notFound.description')}
        </p>
        <div className="mt-4 flex justify-center">
          <NavigationLink 
            href="/dashboard"
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 w-full text-center"
          >
            {t('system.notFound.dashboard')}
          </NavigationLink>
        </div>
      </div>
    </div>
  )
} 