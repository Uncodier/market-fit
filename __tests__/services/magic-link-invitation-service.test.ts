import { processTeamInvitation } from '@/app/services/magic-link-invitation-service'

describe('processTeamInvitation', () => {
  beforeEach(() => {
    jest.restoreAllMocks()
  })

  it('accepts invitations through the verified server endpoint', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      {
        ok: true,
        json: jest.fn().mockResolvedValue({
          success: true,
          redirectTo: '/dashboard/sites/site-1',
        }),
      } as unknown as Response
    )

    const result = await processTeamInvitation({
      siteId: 'site-1',
      siteName: 'Market Fit',
      role: 'create',
      userEmail: 'member@example.com',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/team/accept-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ siteId: 'site-1' }),
    })
    expect(result).toEqual({
      success: true,
      redirectTo: '/dashboard/sites/site-1',
    })
  })

  it('returns the server rejection for an invitation issued to another account', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      {
        ok: false,
        json: jest.fn().mockResolvedValue({
          success: false,
          error: 'This invitation was not issued to your account',
        }),
      } as unknown as Response
    )

    await expect(
      processTeamInvitation({
        siteId: 'site-1',
        siteName: 'Market Fit',
        role: 'view',
        userEmail: 'attacker@example.com',
      })
    ).resolves.toEqual({
      success: false,
      error: 'This invitation was not issued to your account',
    })
  })
})
