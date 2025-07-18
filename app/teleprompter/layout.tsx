import { Metadata } from 'next'
import { Toaster } from "sonner"
import { SiteProvider } from "@/app/context/SiteContext"
import "@/app/globals.css"

export const metadata: Metadata = {
  title: 'Teleprompter',
  description: 'Full screen teleprompter for video content',
}

export default function TeleprompterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      <SiteProvider>
        {children}
      </SiteProvider>
      <Toaster />
    </div>
  )
} 