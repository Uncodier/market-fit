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
      <h1 className="text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-[32px] sm:leading-[1.15]">
        {greeting}{firstName ? `, ${firstName}` : ''}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-[15px]">
        Start with a goal, question, or task.
      </p>
    </div>
  )
}
