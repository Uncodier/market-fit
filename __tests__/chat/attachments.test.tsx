import { fireEvent, render, screen } from '@testing-library/react'
import { ChatAttachments } from '@/app/components/chat/ChatAttachments'
import { chatAttachmentText, getChatAttachments, normalizeChatAttachments } from '@/lib/chat/attachments'
import { ChatMessageContent } from '@/app/components/chat/chat-message-content'

jest.mock('next/image', () => jest.requireActual('next/image'))
jest.mock('react-markdown', () => ({ __esModule: true, default: ({ children }: { children: string }) => <div>{children}</div> }))
jest.mock('remark-gfm', () => ({ __esModule: true, default: jest.fn() }))
jest.mock('@/app/components/email/EmailViewer', () => ({ EmailViewer: () => null }))
jest.mock('@/app/components/chat/CommentReplyContext', () => ({
  CommentReplyContext: () => null,
  useCommentDisplayContext: () => ({ showMessagePostContext: false }),
}))
jest.mock('@/app/components/chat/PostContextCard', () => ({ PostContextCard: () => null }))

describe('chat attachments', () => {
  it.each(['web', 'website_chat', 'email', 'whatsapp', 'instagram', 'messenger', 'facebook', 'threads', 'linkedin', 'x', 'youtube', 'sms', 'telegram', 'voice'])(
    'renders the persisted attachment contract independently of channel %s', channel => {
      render(<ChatMessageContent message={{ role: 'user', timestamp: new Date(), text: '[image]',
        metadata: { channel, attachments: [{ url: 'https://files.example.test/photo', content_type: 'image/jpeg', name: 'Photo' }] },
      }} />)
      expect(screen.getByAltText('Photo')).toBeInTheDocument()
      expect(screen.queryByText('[image]')).not.toBeInTheDocument()
    },
  )

  it('renders historical media-only Outstand DMs and deduplicates migrated records', () => {
    const url = 'https://files.example.test/photo.jpg'
    const metadata = { source: 'outstand_dm', media_urls: [url, 'javascript:alert(1)'] }
    render(<ChatMessageContent message={{ role: 'user', timestamp: new Date(), text: '', metadata }} />)
    expect(screen.getByAltText('Image attachment')).toBeInTheDocument()
    expect(getChatAttachments({ ...metadata, attachments: [{ url }] })).toHaveLength(1)
    expect(getChatAttachments({ source: 'comment', media_urls: [url] })).toEqual([])
  })

  it('renders persisted metadata in message content and preserves historical missing-file markers', () => {
    const message = {
      role: 'user' as const, timestamp: new Date(), text: '[image]',
      metadata: { attachments: [{ url: 'https://files.example.test/photo.jpg', name: 'Photo' }] },
    }
    const { rerender } = render(<ChatMessageContent message={message} />)
    expect(screen.getByAltText('Photo')).toBeInTheDocument()
    expect(screen.queryByText('[image]')).not.toBeInTheDocument()
    rerender(<ChatMessageContent message={{ ...message, text: 'My caption' }} />)
    expect(screen.getByText('My caption')).toBeInTheDocument()
    rerender(<ChatMessageContent message={{ ...message, metadata: {} }} />)
    expect(screen.getByText('[image]')).toBeInTheDocument()
  })
  it('normalizes aliases, deduplicates and rejects unsafe URLs', () => {
    expect(normalizeChatAttachments([
      { mediaUrl: 'https://files.example.test/photo', contentType: 'image/jpeg', fileName: 'Photo' },
      { url: 'https://files.example.test/photo' },
      { url: 'javascript:alert(1)' }, { url: 'data:image/png;base64,a' },
      { url: 'https://user:password@files.example.test/a' }, null,
    ])).toEqual([{ url: 'https://files.example.test/photo', mimeType: 'image/jpeg', name: 'Photo', kind: 'image' }])
    expect(normalizeChatAttachments({})).toEqual([])
    expect(normalizeChatAttachments(Array.from({ length: 20 }, (_, i) => ({ url: `https://files.example.test/${i}` })))).toHaveLength(10)
  })

  it('classifies all supported kinds and does not expose query strings as names', () => {
    const attachments = normalizeChatAttachments([
      { url: 'https://files.example.test/1', type: 'sticker' },
      { url: 'https://files.example.test/2', mime_type: 'audio/ogg' },
      { url: 'https://files.example.test/3.mp4?signature=private' },
      { url: 'https://files.example.test/4', contentType: 'application/pdf', filename: 'report.pdf' },
    ])
    expect(attachments.map(a => a.kind)).toEqual(['sticker', 'audio', 'video', 'document'])
    expect(attachments[2].name).toBe('Video attachment')
  })

  it('preserves captions, transcriptions and markers with missing attachments', () => {
    const attachments = normalizeChatAttachments([{ url: 'https://files.example.test/photo.jpg' }])
    expect(chatAttachmentText('[image]', attachments)).toBe('')
    for (const value of ['[image]: A caption', 'A caption', '[Nota de voz transcrita]: hello', '[audio]']) {
      expect(chatAttachmentText(value, attachments)).toBe(value)
    }
    expect(chatAttachmentText('[image]', [])).toBe('[image]')
  })

  it('renders media controls and file links without autoplay or preloading recordings', () => {
    const attachments = normalizeChatAttachments([
      { url: 'https://files.example.test/1.jpg', name: 'Photo' },
      { url: 'https://files.example.test/2.webp', type: 'sticker', name: 'Sticker' },
      { url: 'https://files.example.test/3.ogg', name: 'Voice note' },
      { url: 'https://files.example.test/4.mp4', name: 'Video' },
      { url: 'https://files.example.test/5.pdf', name: 'Report' },
    ])
    render(<ChatAttachments attachments={attachments} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
    for (const name of ['Voice note', 'Video']) {
      expect(screen.getByLabelText(name)).toHaveAttribute('controls')
      expect(screen.getByLabelText(name)).toHaveAttribute('preload', 'none')
      expect(screen.getByLabelText(name)).not.toHaveAttribute('autoplay')
    }
    expect(screen.getByRole('link', { name: 'Open file: Report' })).toHaveAttribute('rel', 'noopener noreferrer')
    fireEvent.error(screen.getByAltText('Photo'))
    expect(screen.getByRole('status')).toHaveTextContent('Preview unavailable')
    expect(screen.getByRole('link', { name: 'Open original: Photo' })).toBeInTheDocument()
  })
})