import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { HomeShell } from '@/app/home/home-shell'
import { PortalDemoProvider } from '@/app/home/demo-context'

let pathname = '/home'
jest.mock('next/navigation', () => ({ usePathname: () => pathname }))
jest.mock('@/app/buyer/components/BuyerShell', () => ({
  BuyerShell: ({ requireAuth, children }: { requireAuth: boolean; children: ReactNode }) =>
    <div data-testid="shell" data-require-auth={String(requireAuth)}>{children}</div>,
}))

test.each([
  { path: '/home', demo: true, requireAuth: false },
  { path: '/home', demo: false, requireAuth: true },
  { path: '/home/orders', demo: true, requireAuth: false },
  { path: '/home/library', demo: true, requireAuth: false },
  { path: '/home/subscriptions', demo: true, requireAuth: false },
  { path: '/home/quotes', demo: true, requireAuth: false },
  { path: '/home/orders', demo: false, requireAuth: true },
  { path: '/home/preview/orders/demo-order-1', demo: true, requireAuth: false },
  { path: '/home/preview/orders/demo-order-1', demo: false, requireAuth: true },
  { path: '/home/unknown', demo: true, requireAuth: true },
  { path: '/home/profile', demo: true, requireAuth: false },
])('keeps authentication boundaries for $path (demo: $demo)', ({ path, demo, requireAuth }) => {
  pathname = path
  render(<PortalDemoProvider demo={demo}><HomeShell>Account</HomeShell></PortalDemoProvider>)
  expect(screen.getByTestId('shell')).toHaveAttribute('data-require-auth', String(requireAuth))
})