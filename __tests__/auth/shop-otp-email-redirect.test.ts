import { shopOtpEmailRedirectTo } from '@/lib/auth/shop-otp-email-redirect'

describe('shopOtpEmailRedirectTo', () => {
  it('uses app.makinari.com from the www shop so GoTrue keeps the redirect', () => {
    const url = shopOtpEmailRedirectTo({
      pathname: '/shop/habi',
      search: '',
      hostname: 'makinari.com',
      origin: 'https://makinari.com',
    })
    expect(url).toBe(
      'https://app.makinari.com/auth/confirm?auth_channel=otp&returnTo=%2Fshop%2Fhabi'
    )
  })

  it('keeps localhost for local Auth redirect URLs', () => {
    const url = shopOtpEmailRedirectTo({
      pathname: '/shop/habi',
      search: '',
      hostname: 'localhost',
      origin: 'http://localhost:3000',
    })
    expect(url).toContain('http://localhost:3000/auth/confirm?auth_channel=otp')
  })
})
