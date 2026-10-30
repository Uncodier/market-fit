import { render } from '@testing-library/react'
import { PrivateTypography } from '@/app/components/PrivateTypography'

test.each(['/dashboard', '/dashboard?report=performance', '/settings/team', '/purchases/rules',
  '/suppliers', '/catalog', '/home', '/home/profile', '/buyer/orders'])
('keeps Inter scoped to private screen %s', pathname => {
  const view = render(<PrivateTypography pathname={pathname}><h1>Title</h1></PrivateTypography>)
  expect(view.container.querySelector('[data-private-typography]')).toHaveClass('contents')
})

test.each(['/', '/shop/pigs', '/marketplace', '/tenders', '/tenders/pigs/event',
  '/book/pigs/location/service', '/auth/login', '/homecoming'])
('preserves public brand typography on %s', pathname => {
  const view = render(<PrivateTypography pathname={pathname}><h1>Title</h1></PrivateTypography>)
  expect(view.container.querySelector('[data-private-typography]')).toBeNull()
})

test('updates the scope when navigating between private and public screens', () => {
  const view = render(<PrivateTypography pathname="/dashboard">Content</PrivateTypography>)
  expect(view.container.querySelector('[data-private-typography]')).not.toBeNull()
  view.rerender(<PrivateTypography pathname="/shop/pigs">Content</PrivateTypography>)
  expect(view.container.querySelector('[data-private-typography]')).toBeNull()
  view.rerender(<PrivateTypography pathname="/home/profile">Content</PrivateTypography>)
  expect(view.container.querySelector('[data-private-typography]')).not.toBeNull()
})