/** @jest-environment node */

describe('private QA development origin', () => {
  it('allows the explicit loopback tunnel hostname without wildcard origins', () => {
    const config = require('../../next.config.js')
    expect(config.allowedDevOrigins).toContain('127.0.0.1')
    expect(config.allowedDevOrigins).not.toContain('*')
    expect(config.allowedDevOrigins.every((host: string) => !host.includes('://') && !host.includes(':'))).toBe(true)
  })
})