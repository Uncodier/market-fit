import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { ImprentaCardResult } from '@/app/components/agents/imprenta-panel/card-result'
import { extractImprentaResultText } from '@/app/components/agents/imprenta-panel/result-text'

jest.mock('@/app/components/agents/imprenta-panel/markdown', () => ({
  MemoMarkdown: ({ text }: { text: string }) => <div>{text}</div>,
}))
jest.mock('@/app/components/agents/imprenta-audience-leads-carousel', () => ({
  ImprentaAudienceLeadsCarousel: () => null,
}))
jest.mock('@/app/components/agents/imprenta-uploaded-file', () => ({ ImprentaUploadedFile: () => null }))
jest.mock('@/app/components/agents/audio-player', () => ({ AudioPlayer: () => null }))

type Props = ComponentProps<typeof ImprentaCardResult>

function renderResult(result: Props['node']['result']) {
  const node: Props['node'] = {
    id: 'node-saas-7', instance_id: 'remote-saas-1', parent_node_id: null,
    original_node_id: null, parent_instance_log_id: null, type: 'publish',
    status: 'completed', result, settings: {}, prompt: {}, site_id: 'demo-saas-en-123',
    user_id: 'demo-user-123', created_at: '', updated_at: '',
  }
  const renderResultMedia = jest.fn((_url: string, _type: 'image' | 'video', key: React.Key) => <div key={key}>Media preview</div>)
  render(<ImprentaCardResult node={node} nodes={[]} logs={[]} currentSite={null}
    actions={{} as Props['actions']} hasResult isVisualMediaCard={false}
    renderResultMedia={renderResultMedia} mediaAspect="1 / 1" />)
  return renderResultMedia
}

describe('Imprenta text results', () => {
  it('renders nested publication outputs instead of an empty completed result', () => {
    renderResult({ outputs: [{ type: 'text', data: { text: 'Scheduled 2 posts for tomorrow at 9:00 AM' } }] })
    expect(screen.getByText('Scheduled 2 posts for tomorrow at 9:00 AM')).toBeInTheDocument()
  })

  it('renders text alongside structured media', () => {
    const renderMedia = renderResult({ outputs: [
      { type: 'image', data: { url: 'https://example.com/image.png' } },
      { type: 'text', data: { text: 'Campaign ready' } },
    ] })
    expect(screen.getByText('Campaign ready')).toBeInTheDocument()
    expect(renderMedia).toHaveBeenCalledWith('https://example.com/image.png', 'image', 0)
  })

  it('preserves top-level text without duplicating outputs', () => {
    expect(extractImprentaResultText({ text: 'Summary', outputs: [{ type: 'text', text: 'Summary' }] })).toBe('Summary')
  })

  it('combines text outputs and ignores empty or malformed entries', () => {
    expect(extractImprentaResultText({ outputs: [null, {}, { type: 'text', text: 'First' },
      { type: 'text', data: { text: 'Second' } }, { type: 'text', text: ' ' },
      { type: 'image', text: 'Not a text output' }] })).toBe('First\n\nSecond')
    expect(extractImprentaResultText(null)).toBe('')
  })
})