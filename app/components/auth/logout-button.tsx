'use client'

import { Button } from '../ui/button'
import { LogOut } from '@/app/components/ui/icons'

interface LogoutButtonProps {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function LogoutButton({
  variant = 'default',
  size = 'default',
  className = '',
}: LogoutButtonProps) {
  const handleLogout = () => {
    window.location.href = '/api/auth/logout'
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleLogout}
    >
      <LogOut className="mr-2 h-4 w-4" />
      Cerrar sesión
    </Button>
  )
} 