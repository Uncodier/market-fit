import React from 'react'
import { formatTime } from '../utils'

interface LoadingIndicatorProps {
  isVisible: boolean
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ isVisible }) => {
  if (!isVisible) return null

  return (
    <div className="flex flex-col w-full min-w-0 items-start group">
      <div className="flex items-center mb-1 gap-2 w-full min-w-0">
        <div className="relative">
          <div className="h-7 w-7 border border-primary/20 rounded-full font-inter bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
            A
          </div>
        </div>
        <span className="text-sm font-medium text-primary">Robot</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-inter bg-primary/10 text-primary border border-primary/20 font-medium">
          thinking
        </span>
        <span className="text-xs text-muted-foreground">
          {formatTime(new Date())}
        </span>
      </div>

      {/* Thinking bubble */}
      <div className="mr-8 w-full min-w-0 overflow-hidden">
        <div className="relative rounded-xl p-4 border border-primary/15 bg-background/60 backdrop-blur-sm overflow-hidden">
          {/* Floating orbs */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-violet-500/8 rounded-full font-inter blur-2xl animate-[float-slow_20s_ease-in-out_infinite]" />
            <div className="absolute top-0 left-1/4 w-20 h-20 bg-indigo-500/10 rounded-full font-inter blur-xl animate-[float-medium_18s_ease-in-out_infinite]" style={{ animationDelay: '3s' }} />
            <div className="absolute bottom-0 right-1/4 w-24 h-24 bg-purple-500/8 rounded-full font-inter blur-xl animate-[float-reverse_22s_ease-in-out_infinite]" style={{ animationDelay: '6s' }} />
            <div className="absolute top-1/3 right-8 w-16 h-16 bg-pink-500/10 rounded-full font-inter blur-xl animate-[float-fast_16s_ease-in-out_infinite]" style={{ animationDelay: '1s' }} />
          </div>

          {/* Content */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full font-inter bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full font-inter bg-primary/70 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full font-inter bg-primary/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-muted-foreground">Robot is thinking...</span>
          </div>
          <p className="relative z-10 text-xs text-muted-foreground/60 mt-2 mb-0">
            Processing your request and preparing a response
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes float-slow {
          0%   { transform: translate(0, 0) scale(1); }
          25%  { transform: translate(30px, -20px) scale(1.1); }
          50%  { transform: translate(-20px, -35px) scale(0.9); }
          75%  { transform: translate(-30px, -10px) scale(1.05); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes float-medium {
          0%   { transform: translate(0, 0) scale(1); }
          33%  { transform: translate(-25px, 20px) scale(1.15); }
          66%  { transform: translate(20px, -15px) scale(0.85); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes float-fast {
          0%   { transform: translate(0, 0) scale(1); }
          20%  { transform: translate(-15px, -12px) scale(1.2); }
          40%  { transform: translate(20px, -25px) scale(0.8); }
          60%  { transform: translate(25px, 8px) scale(1.1); }
          80%  { transform: translate(-5px, -30px) scale(0.9); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes float-reverse {
          0%   { transform: translate(0, 0) scale(1); }
          25%  { transform: translate(-20px, 15px) scale(0.85); }
          50%  { transform: translate(15px, 25px) scale(1.2); }
          75%  { transform: translate(25px, 8px) scale(0.95); }
          100% { transform: translate(0, 0) scale(1); }
        }
      `}</style>
    </div>
  )
}
