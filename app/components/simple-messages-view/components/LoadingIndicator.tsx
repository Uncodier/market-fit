import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LoadingIndicatorProps {
  isVisible: boolean
  isDarkMode?: boolean
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ isVisible, isDarkMode = false }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="w-full min-w-[min(100%,450px)] overflow-hidden max-w-[calc(100%-80px)] lg:max-w-3xl mx-auto my-2"
        >
          <div
            className="rounded-lg text-xs relative overflow-hidden"
            style={{
              backgroundColor: isDarkMode ? '#2d2d3d' : '#f0f0f5',
              borderLeft: '3px solid var(--primary)',
              boxShadow: 'none',
              outline: 'none',
              filter: 'none'
            }}
          >
            {/* Animated background subtle gradient / shimmering */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-[shimmer_2s_infinite]" style={{ backgroundSize: '200% 100%' }} />

            <div className="pt-2 pb-2 px-3 space-y-2 relative z-10">
              <div className="flex items-center gap-3 px-2 py-1">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full font-inter bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full font-inter bg-primary/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full font-inter bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-xs text-muted-foreground/60 m-0">
                  Makina está pensando y preparando una respuesta...
                </p>
              </div>
            </div>
          </div>
          
          <style jsx>{`
            @keyframes shimmer {
              0% { background-position: 200% 0; }
              100% { background-position: -200% 0; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
