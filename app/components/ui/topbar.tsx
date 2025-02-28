interface TopbarProps {
  children: React.ReactNode
}

export function Topbar({ children }: TopbarProps) {
  return (
    <div className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="h-16 flex items-center">
        {children}
      </div>
    </div>
  )
} 