import { shouldClearDemoCookieOnPath } from '@/lib/auth/workspace-site-redirect'

it.each(['/tenders', '/tenders/demo-procurement', '/tenders/demo-procurement/demo-tender-workplace',
  '/home/tenders', '/home/submissions', '/home/profile', '/purchases/quotes'])('retains explicit demo mode across procurement navigation: %s', path => {
  expect(shouldClearDemoCookieOnPath(path)).toBe(false)
})

it.each(['/shop/store', '/marketplace', '/cart/checkout', '/book/store', '/q/token', '/i/token', '/so/token', '/vb/token'])('still exits demo before real commerce: %s', path => {
  expect(shouldClearDemoCookieOnPath(path)).toBe(true)
})