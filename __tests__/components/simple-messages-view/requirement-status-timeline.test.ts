import { buildRequirementStatusTimelineItem } from '@/app/components/simple-messages-view/requirement-status-timeline'

describe('buildRequirementStatusTimelineItem', () => {
  it('keeps repeated statuses anchored to their first occurrence', () => {
    const item = buildRequirementStatusTimelineItem([
      {
        id: 'first',
        requirement_id: 'requirement-1',
        stage: 'on-review',
        message: 'Project complete',
        created_at: '2026-09-15T20:30:52.000Z',
      },
      {
        id: 'latest',
        requirement_id: 'requirement-1',
        stage: 'on-review',
        message: 'Project complete',
        created_at: '2026-09-15T20:43:51.000Z',
      },
    ])

    expect(item?.timestamp).toBe('2026-09-15T20:30:52.000Z')
    expect(item?.data.id).toBe('latest')
    expect(item?.data.created_at).toBe('2026-09-15T20:30:52.000Z')
  })

  it('moves to the time of a genuinely different status update', () => {
    const item = buildRequirementStatusTimelineItem([
      {
        id: 'review',
        requirement_id: 'requirement-1',
        stage: 'on-review',
        message: 'Ready for review',
        created_at: '2026-09-15T20:30:52.000Z',
      },
      {
        id: 'blocked',
        requirement_id: 'requirement-1',
        stage: 'blocked',
        message: 'Approval required',
        created_at: '2026-09-15T20:43:51.000Z',
      },
    ])

    expect(item?.timestamp).toBe('2026-09-15T20:43:51.000Z')
    expect(item?.data.id).toBe('blocked')
  })

  it('uses the newest available links without changing the anchor time', () => {
    const item = buildRequirementStatusTimelineItem([
      {
        id: 'first',
        requirement_id: 'requirement-1',
        stage: 'on-review',
        message: 'Project complete',
        created_at: '2026-09-15T20:30:52.000Z',
        preview_url: 'https://preview.example.com',
      },
      {
        id: 'latest',
        requirement_id: 'requirement-1',
        stage: 'on-review',
        message: 'Project complete',
        created_at: '2026-09-15T20:43:51.000Z',
        source_code: 'https://source.example.com',
      },
    ])

    expect(item?.timestamp).toBe('2026-09-15T20:30:52.000Z')
    expect(item?.data.preview_url).toBe('https://preview.example.com')
    expect(item?.data.source_code).toBe('https://source.example.com')
  })
})
