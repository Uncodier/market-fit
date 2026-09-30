"use client"

import { IconWrapper, type IconProps } from "./icon-wrapper"

export const CursorLogo = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <img src="/images/agents/cursor.svg" alt="Cursor Logo" className="w-full h-full object-contain" />
  </IconWrapper>
)

export const OpenClawLogo = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <img src="/images/agents/openclaw.svg" alt="Open Claw Logo" className="w-full h-full object-contain" />
  </IconWrapper>
)

export const HermesLogo = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <img src="/images/agents/hermes.png" alt="Hermes Logo" className="w-full h-full object-contain" />
  </IconWrapper>
)

export const OpenAILogo = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <img src="/images/agents/openai.svg" alt="OpenAI Logo" className="w-full h-full object-contain" />
  </IconWrapper>
)

export const ClaudeLogo = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <img src="/images/agents/claude.svg" alt="Claude Logo" className="w-full h-full object-contain" />
  </IconWrapper>
)

// Google - Icono específico de Google optimizado para Safari
export const Google = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none">
      <path
        d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0353 3.12C17.9503 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
        fill="#EA4335" />
      <path
        d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
        fill="#4285F4" />
      <path
        d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
        fill="#FBBC05" />
      <path
        d="M12.0004 24C15.2404 24 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.2654 14.29L1.27539 17.385C3.25539 21.31 7.3104 24 12.0004 24Z"
        fill="#34A853" />
    </svg>
  </IconWrapper>
)

// Github
export const Github = ({ className = "", size = 18, ...props }: IconProps) => (
  <IconWrapper className={className} size={size} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.24c3-.34 6-1.53 6-6.36 0-1.4-.5-2.5-1.3-3.45.1-.3.6-1.63-.1-3.41 0 0-1.1-.35-3.6 1.35a12.08 12.08 0 0 0-6.6 0c-2.5-1.7-3.6-1.35-3.6-1.35-.7 1.78-.2 3.11-.1 3.41-.8.9-1.3 2.05-1.3 3.45 0 4.83 3 6 6 6.36-1 3.24-1 4.54-1 4.54" />
      <path d="M9 20c-3 1-4-1-5-2.5" />
    </svg>
  </IconWrapper>
)
