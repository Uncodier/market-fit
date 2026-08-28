import {
  formatToolDisplayName,
  getToolCallSubtitle,
  getToolName,
  parseToolMessageKvs,
} from '@/app/components/simple-messages-view/parse-tool-call'

function log(partial: Record<string, unknown>) {
  return {
    id: '1',
    log_type: 'tool_call',
    level: 'info',
    message: '',
    created_at: '2026-01-01T00:00:00Z',
    ...partial,
  } as any
}

describe('parseToolMessageKvs', () => {
  it('parses action and name after a tool_lookup prefix', () => {
    const kvs = parseToolMessageKvs(
      'tool_lookup: thought_process=Describe webSearch to see its parameters, action=describe, name=webSearch'
    )
    expect(kvs.action).toBe('describe')
    expect(kvs.name).toBe('webSearch')
    expect(kvs.thought_process).toBe('Describe webSearch to see its parameters')
  })

  it('does not treat username as name', () => {
    const kvs = parseToolMessageKvs('catalog_commerce: username=admin, action=list')
    expect(kvs.name).toBeUndefined()
    expect(kvs.action).toBe('list')
  })
})

describe('getToolName + formatToolDisplayName', () => {
  it('shows action first for legacy tool_lookup', () => {
    const name = getToolName(
      log({
        tool_name: 'tool_lookup',
        message:
          'tool_lookup: thought_process=Describe webSearch to see its parameters, action=describe, name=webSearch',
      })
    )
    expect(formatToolDisplayName(name!)).toBe('Describe: webSearch')
  })

  it('treats tools as the same wrapper as tool_lookup', () => {
    const name = getToolName(
      log({
        tool_name: 'tools',
        message: 'tools: action=call, name=catalog_commerce, args={"action":"list"}',
      })
    )
    expect(formatToolDisplayName(name!)).toBe('Call: catalog_commerce')
  })

  it('reads action and name from tool_args', () => {
    const name = getToolName(
      log({
        tool_name: 'tools',
        message: 'tools',
        tool_args: { action: 'describe', name: 'webSearch' },
      })
    )
    expect(formatToolDisplayName(name!)).toBe('Describe: webSearch')
  })

  it('prioritizes action on other tools', () => {
    const name = getToolName(
      log({
        tool_name: 'catalog_commerce',
        message: 'catalog_commerce: action=list, id=item-1',
      })
    )
    expect(formatToolDisplayName(name!)).toBe('List: catalog_commerce')
  })

  it('keeps plain tool names unchanged', () => {
    expect(getToolName(log({ tool_name: 'clearbit_enrich' }))).toBe('clearbit_enrich')
    expect(formatToolDisplayName('clearbit_enrich')).toBe('Clearbit Enrich')
  })

  it('formats legacy encoded keys without saying Tool Lookup', () => {
    expect(formatToolDisplayName('tools_meta:describe:webSearch')).toBe('Describe: webSearch')
    expect(formatToolDisplayName('tool_lookup_webSearch')).toBe('webSearch')
    expect(formatToolDisplayName('tool_lookup')).toBe('Tools')
    expect(formatToolDisplayName('tools')).toBe('Tools')
  })
})

describe('getToolCallSubtitle', () => {
  it('uses thought_process instead of the raw kv dump', () => {
    const subtitle = getToolCallSubtitle(
      log({
        tool_name: 'tool_lookup',
        message:
          'tool_lookup: thought_process=Describe webSearch to see its parameters, action=describe, name=webSearch',
      })
    )
    expect(subtitle).toBe('Describe webSearch to see its parameters')
  })

  it('hides kv dumps when there is no thought_process', () => {
    const subtitle = getToolCallSubtitle(
      log({
        tool_name: 'tools',
        message: 'tools: action=call, name=catalog_commerce',
      })
    )
    expect(subtitle).toBeNull()
  })

  it('keeps human-readable messages', () => {
    const subtitle = getToolCallSubtitle(
      log({
        tool_name: 'clearbit_enrich',
        message: 'Calling clearbit to enrich company data',
      })
    )
    expect(subtitle).toBe('Calling clearbit to enrich company data')
  })
})
