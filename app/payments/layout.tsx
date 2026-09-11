import WorkspaceProviders from '@/app/providers/WorkspaceProviders'

export default function PaymentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <WorkspaceProviders>
      {children}
    </WorkspaceProviders>
  )
}
