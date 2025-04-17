import Link from 'next/link'
import { Button } from '@/app/components/ui/button'
import * as Icons from '@/app/components/ui/icons'

export default function ChatNotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/30">
      <div className="text-center px-6 py-16 max-w-md">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <Icons.MessageSquare className="h-16 w-16 text-primary/20" />
            <Icons.AlertCircle className="h-8 w-8 text-primary absolute bottom-0 right-0" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Conversation Not Found</h1>
        <p className="text-muted-foreground mb-8">
          The chat conversation you are looking for doesn't exist or may have been deleted.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/agents">
              <Icons.ChevronLeft className="mr-2 h-4 w-4" />
              Back to Agents
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Icons.Home className="mr-2 h-4 w-4" />
              Go to Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
} 