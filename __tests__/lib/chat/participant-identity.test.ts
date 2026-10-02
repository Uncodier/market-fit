import { conversationDisplayTitle, resolveParticipantIdentity } from '@/lib/chat/participant-identity'

const dm = {
  channel: 'instagram', title: 'Instagram direct message',
  custom_data: {
    source: 'outstand_dm', participant_display_name: '  Taylor Doe  ',
    participant_username: 'taylor', participant_profile_picture: 'https://example.com/participant.jpg',
  },
}

describe('canonical comment participant identity', () => {
  const custom_data = { source: 'comment', comment_grouping_version: 1, network: 'instagram',
    author_id: 'author-1', author_name: 'Ada Reader', author_username: 'ada',
    publisher_username: 'owned.account', outstand_post_id: 'post-1', publisher_account_id: 'owned' }
  it('uses author metadata rather than owned account data and respects CRM overrides', () => {
    const conversation = { channel: 'instagram', title: 'Social post comments', custom_data }
    expect(resolveParticipantIdentity(conversation).name).toBe('Ada Reader')
    expect(resolveParticipantIdentity(conversation, { name: 'CRM name' }).name).toBe('CRM name')
    expect(conversationDisplayTitle(conversation)).toBe('Ada Reader')
    expect(conversationDisplayTitle({ ...conversation, title: 'Manual subject' })).toBe('Manual subject')
  })
  it('does not pretend legacy mixed comments belong to one stored author', () => {
    expect(resolveParticipantIdentity({ channel: 'instagram', custom_data: { ...custom_data, comment_grouping_version: undefined } }).name)
      .toBe('Instagram contact')
  })
  it('keeps LinkedIn identity resolve-on-read instead of rendering persisted member metadata', () => {
    expect(resolveParticipantIdentity({ channel: 'linkedin', custom_data: { ...custom_data, network: 'linkedin' } }).name)
      .toBe('LinkedIn contact')
  })
})

describe('DM participant display identity', () => {
  it('prioritizes a linked/manual lead name and avatar over provider attributes', () => {
    expect(resolveParticipantIdentity(dm, { name: ' CRM name ', avatarUrl: 'https://example.com/manual.jpg' }))
      .toEqual({ name: 'CRM name', avatarUrl: 'https://example.com/manual.jpg', channel: 'instagram' })
    expect(resolveParticipantIdentity(dm).name).toBe('Taylor Doe')
  })

  it.each(['taylor', '@taylor'])('uses an explicit username %s only when display name is missing', username => {
    expect(resolveParticipantIdentity({ ...dm, custom_data: { source: 'outstand_dm', participant_username: username } }, { name: ' ' }).name)
      .toBe('@taylor')
  })

  it('never uses an IGSID, owned publishing account, or title as participant identity', () => {
    const conversation = {
      ...dm, title: 'Manual subject', custom_data: {
        source: 'outstand_dm',
        participant_display_name: null, participant_username: null, participant_profile_picture: null,
        outstand_participant_id: '123456789012345', outstand_social_account_id: 'owned-account',
        display_name: 'Owned Business', username: 'owned_business', profile_picture: 'https://example.com/owned.jpg',
        socialAccount: { name: 'Owned Business', username: 'owned_business' },
        metadata: { platformAccountId: 'owned-platform-id' },
      },
    }
    expect(resolveParticipantIdentity(conversation)).toEqual({ name: 'Instagram contact', channel: 'instagram' })
  })

  it.each([null, [], 'bad', { participant_display_name: 12, participant_username: {}, participant_profile_picture: [] }])
    ('handles malformed metadata without manufacturing identity', custom_data => {
      expect(resolveParticipantIdentity({ ...dm, custom_data }).name).toBe('Instagram contact')
    })

  it.each(['javascript:alert(1)', 'data:image/svg+xml,test', 'http://example.com/a.jpg', 'https://user:secret@example.com/a.jpg'])
    ('does not render an unsafe participant image: %s', participant_profile_picture => {
      expect(resolveParticipantIdentity({ ...dm, custom_data: { source: 'outstand_dm', participant_profile_picture } }).avatarUrl).toBeUndefined()
    })

  it('keeps web visitor fallback and allows a picture without claiming a name', () => {
    expect(resolveParticipantIdentity({ channel: 'website_chat' }).name).toBe('Visitor')
    expect(resolveParticipantIdentity({ ...dm, custom_data: { source: 'outstand_dm', participant_profile_picture: dm.custom_data.participant_profile_picture } }))
      .toEqual({ name: 'Instagram contact', avatarUrl: dm.custom_data.participant_profile_picture, channel: 'instagram' })
  })

  it('preserves manual subjects but refreshes generic or explicitly generated titles with the lead name first', () => {
    expect(conversationDisplayTitle(dm)).toBe('Taylor Doe')
    expect(conversationDisplayTitle(dm, 'CRM name')).toBe('CRM name')
    expect(conversationDisplayTitle({ ...dm, title: 'Manual subject' }, 'CRM name')).toBe('Manual subject')
    expect(conversationDisplayTitle({ ...dm, title: 'Old name', custom_data: { ...dm.custom_data, outstand_generated_title: 'Old name' } }, 'CRM name'))
      .toBe('CRM name')
    expect(conversationDisplayTitle({ channel: 'web', title: null }, 'CRM name')).toBe('Chat with CRM name')
  })

  it.each(['web', 'linkedin', 'email'])('does not consume DM metadata on %s conversations', channel => {
    const identity = resolveParticipantIdentity({ ...dm, channel })
    expect(identity.name).not.toBe('Taylor Doe')
    expect(identity.avatarUrl).toBeUndefined()
  })

  it('does not consume Instagram metadata without the explicit Outstand DM source', () => {
    expect(resolveParticipantIdentity({ ...dm, custom_data: { ...dm.custom_data, source: 'comment' } }))
      .toEqual({ name: 'Instagram contact', channel: 'instagram' })
  })

  it.each(['has spaces', 'https://example.com', '@@taylor', 'unknown', 'a'.repeat(31)])('rejects malformed handles: %s', participant_username => {
    expect(resolveParticipantIdentity({ ...dm, custom_data: { source: 'outstand_dm', participant_username } }).name).toBe('Instagram contact')
  })

  it.each(['Visitor', 'unknown', '1234567890', 'https://example.com'])('does not mistake placeholder display names for identity: %s', participant_display_name => {
    expect(resolveParticipantIdentity({ ...dm, custom_data: { ...dm.custom_data, participant_display_name } }).name).toBe('@taylor')
  })
})