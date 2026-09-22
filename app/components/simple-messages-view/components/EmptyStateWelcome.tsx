import { useEffect, useState } from 'react'

interface EmptyStateWelcomeProps {
  userName?: string | null
}

export function getGreetingForHour(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function EmptyStateWelcome({ userName }: EmptyStateWelcomeProps) {
  const [greeting, setGreeting] = useState('Welcome')
  const firstName = userName?.trim().split(/\s+/)[0]

  useEffect(() => {
    setGreeting(getGreetingForHour(new Date().getHours()))
  }, [])

  return (
    <div className="px-4 text-center">
      <h1 className="text-xl font-medium tracking-tight text-foreground sm:text-2xl">
        {greeting}{firstName ? `, ${firstName}` : ''}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        What would you like to work on?
      </p>
    </div>
  )
}
