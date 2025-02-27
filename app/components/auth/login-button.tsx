'use client'

import { Button } from '../ui/button'
import { LogIn } from '@/app/components/ui/icons'

interface LoginButtonProps {
  returnTo?: string
  className?: string
}

export function LoginButton({ returnTo, className }: LoginButtonProps) {
  const handleLogin = () => {
    const loginUrl = returnTo
      ? `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`
      : '/api/auth/login'
    
    window.location.href = loginUrl
  }

  return (
    <Button 
      onClick={handleLogin} 
      variant="default"
      className={className}
    >
      <LogIn className="mr-2 h-4 w-4" />
      Sign in
    </Button>
  )
} 