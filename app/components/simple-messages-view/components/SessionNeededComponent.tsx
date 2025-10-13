import React from 'react'
import { Button } from '@/app/components/ui/button'
import { AlertCircle, ExternalLink, Key, Shield } from '@/app/components/ui/icons'
import { StructuredOutputResponse } from '../types'

interface SessionNeededComponentProps {
  structuredData: StructuredOutputResponse
  isDarkMode: boolean
}

export const SessionNeededComponent: React.FC<SessionNeededComponentProps> = ({
  structuredData,
  isDarkMode
}) => {
  const handleProvideSession = () => {
    // TODO: Implement session provision logic
    console.log('Provide session clicked for step:', structuredData.step)
  }

  const handleSkipStep = () => {
    // TODO: Implement skip step logic
    console.log('Skip step clicked for step:', structuredData.step)
  }

  const getPlatformInfo = (message: string) => {
    // Extract platform information from the message
    if (message.toLowerCase().includes('pinterest')) {
      return {
        name: 'Pinterest',
        icon: '📌',
        color: '#e60023',
        url: 'https://pinterest.com'
      }
    }
    if (message.toLowerCase().includes('instagram')) {
      return {
        name: 'Instagram',
        icon: '📷',
        color: '#E4405F',
        url: 'https://instagram.com'
      }
    }
    if (message.toLowerCase().includes('facebook')) {
      return {
        name: 'Facebook',
        icon: '👥',
        color: '#1877F2',
        url: 'https://facebook.com'
      }
    }
    if (message.toLowerCase().includes('twitter') || message.toLowerCase().includes('x.com')) {
      return {
        name: 'X (Twitter)',
        icon: '🐦',
        color: '#1DA1F2',
        url: 'https://x.com'
      }
    }
    if (message.toLowerCase().includes('linkedin')) {
      return {
        name: 'LinkedIn',
        icon: '💼',
        color: '#0077B5',
        url: 'https://linkedin.com'
      }
    }
    if (message.toLowerCase().includes('youtube')) {
      return {
        name: 'YouTube',
        icon: '📺',
        color: '#FF0000',
        url: 'https://youtube.com'
      }
    }
    if (message.toLowerCase().includes('tiktok')) {
      return {
        name: 'TikTok',
        icon: '🎵',
        color: '#000000',
        url: 'https://tiktok.com'
      }
    }
    
    return {
      name: 'Platform',
      icon: '🔐',
      color: '#6B7280',
      url: null
    }
  }

  // Extract the assistant message from the structured data
  const assistantMessage = structuredData.assistant_message || ''
  const platformInfo = getPlatformInfo(assistantMessage)

  return (
    <div className="text-xs p-4 rounded-lg border-2 overflow-hidden transition-all duration-200 hover:shadow-md"
         style={{
           borderColor: isDarkMode ? '#f59e0b' : '#ff9800',
           backgroundColor: isDarkMode ? 'rgba(251, 191, 36, 0.08)' : '#fff3e0'
         }}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-shrink-0">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-lg"
               style={{ backgroundColor: platformInfo.color + '20' }}>
            {platformInfo.icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4" style={{ color: isDarkMode ? '#fbbf24' : '#f57c00' }} />
            <span className="font-semibold text-sm" style={{ color: isDarkMode ? '#fbbf24' : '#f57c00' }}>
              Authentication Required
            </span>
            {structuredData.step && (
              <span className="text-xs px-2 py-1 rounded-full border font-medium"
                    style={{ 
                      backgroundColor: (isDarkMode ? '#fbbf24' : '#f57c00') + '20',
                      color: isDarkMode ? '#fbbf24' : '#f57c00',
                      borderColor: (isDarkMode ? '#fbbf24' : '#f57c00') + '40'
                    }}>
                Step {structuredData.step}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            {platformInfo.name} authentication is required to continue with the plan.
          </div>
        </div>
      </div>

      {/* Message Content */}
      <div className="bg-white dark:bg-gray-800 rounded-md p-3 mb-3 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {assistantMessage}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <Button
          onClick={handleProvideSession}
          size="sm"
          className="flex items-center gap-2 text-xs"
          style={{
            backgroundColor: platformInfo.color,
            borderColor: platformInfo.color,
            color: 'white'
          }}
        >
          <Key className="w-3 h-3" />
          Provide Session
        </Button>
        
        {platformInfo.url && (
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 text-xs"
            onClick={() => window.open(platformInfo.url, '_blank')}
          >
            <ExternalLink className="w-3 h-3" />
            Open {platformInfo.name}
          </Button>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700"
          onClick={handleSkipStep}
        >
          Skip Step
        </Button>
      </div>

      {/* Help Text */}
      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
          <span>You can provide authentication credentials or skip this step to continue with the plan.</span>
        </div>
      </div>
    </div>
  )
}
