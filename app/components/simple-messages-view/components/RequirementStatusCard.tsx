import React from 'react'
import { ExternalLink, CheckCircle2, AlertCircle, Info, Clock, CheckCircle } from "@/app/components/ui/icons"
import { useTheme } from "@/app/context/ThemeContext"
import { useLocalization } from "@/app/context/LocalizationContext"

interface RequirementStatusCardProps {
  status: any
}

export const RequirementStatusCard: React.FC<RequirementStatusCardProps> = ({ status }) => {
  const { isDarkMode } = useTheme()
  const { t } = useLocalization()
  const isCompleted = status.status?.toLowerCase() === 'completed' || status.status?.toLowerCase() === 'success'
  const isFailed = status.status?.toLowerCase() === 'failed' || status.status?.toLowerCase() === 'error'
  
  const baseClasses = isCompleted
    ? {
        container: isDarkMode 
          ? 'bg-green-900/20 border-green-700/30' 
          : 'bg-green-50/50 border-green-200/50',
        labelWrap: isDarkMode 
          ? 'text-green-400 bg-green-800/30' 
          : 'text-green-600 bg-green-100',
        title: isDarkMode 
          ? 'text-green-300' 
          : 'text-green-800',
        text: isDarkMode 
          ? 'text-green-400' 
          : 'text-green-700',
        meta: isDarkMode 
          ? 'text-green-500' 
          : 'text-green-600',
        label: 'Requirement ' + status.status,
      }
    : isFailed
    ? {
        container: isDarkMode 
          ? 'bg-red-900/20 border-red-700/30' 
          : 'bg-red-50/50 border-red-200/50',
        labelWrap: isDarkMode 
          ? 'text-red-400 bg-red-800/30' 
          : 'text-red-600 bg-red-100',
        title: isDarkMode 
          ? 'text-red-300' 
          : 'text-red-800',
        text: isDarkMode 
          ? 'text-red-400' 
          : 'text-red-700',
        meta: isDarkMode 
          ? 'text-red-500' 
          : 'text-red-600',
        label: 'Requirement ' + status.status,
      }
    : {
        container: isDarkMode 
          ? 'bg-blue-900/20 border-blue-700/30' 
          : 'bg-blue-50/50 border-blue-200/50',
        labelWrap: isDarkMode 
          ? 'text-blue-400 bg-blue-800/30' 
          : 'text-blue-600 bg-blue-100',
        title: isDarkMode 
          ? 'text-blue-300' 
          : 'text-blue-800',
        text: isDarkMode 
          ? 'text-blue-400' 
          : 'text-blue-700',
        meta: isDarkMode 
          ? 'text-blue-500' 
          : 'text-blue-600',
        label: 'Requirement ' + status.status,
      }

  return (
    <div className="space-y-4 w-full min-w-[min(100%,450px)] overflow-hidden max-w-[calc(100%-80px)] lg:max-w-[calc(100%-240px)] mx-auto mb-4">
      <div className={`${baseClasses.container} border rounded-lg p-4`}>
        <div className="mb-3">
          <span className={`text-xs px-2 py-1 rounded capitalize ${baseClasses.labelWrap}`}>
            {baseClasses.label}
          </span>
        </div>
        
        {status.message && (
          <div className="mb-3">
            <h4 className={`text-sm leading-relaxed whitespace-pre-wrap ${baseClasses.title}`}>{status.message}</h4>
          </div>
        )}
        
        <div className={`flex flex-wrap items-center gap-4 mt-3 text-xs ${baseClasses.meta}`}>
          {(status.created_at) && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" />
              {new Date(status.created_at).toLocaleString()}
            </span>
          )}
          
          {status.preview_url && (
            <a 
              href={status.preview_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {t('requirements.preview') || 'Preview'}
            </a>
          )}
          
          {status.source_code && (
            <a 
              href={status.source_code} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {t('requirements.sourceCode') || 'Source Code'}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
