import { availableDemos, getDemoData } from '@/lib/demo-data'
import { attachDemoContentResults } from '@/lib/demo-data/content-results'
import { extractImprentaResultText } from '@/app/components/agents/imprenta-panel/result-text'

describe('Demo content results', () => {
  it.each(availableDemos.map(demo => demo.id))('supplies displayable results for completed content nodes in %s', async siteId => {
    const data = await getDemoData(siteId)
    expect(data).not.toBeNull()
    const nodes = data!.instance_nodes as Array<Record<string, unknown>>
    const completed = nodes.filter(node => node.status === 'completed'
      && (node.settings as Record<string, unknown>)?.imprenta_mode)
    expect(completed.length).toBeGreaterThan(0)
    for (const node of completed) {
      const result = node.result as Record<string, unknown>
      expect(result).toBeDefined()
      if (node.type === 'prompt' || node.type === 'publish') {
        expect(extractImprentaResultText(result).trim()).not.toBe('')
      } else {
        expect(Object.keys(result).length).toBeGreaterThan(0)
      }
    }
  })

  it('does not fill unrelated nodes or overwrite existing results', () => {
    const existing = { text: 'Existing copy' }
    const nodes = [{ id: 'real-node' }, { id: 'node-saas-3', result: existing }]
    const data = attachDemoContentResults({ instance_nodes: nodes })
    expect(data.instance_nodes).toEqual(nodes)
    expect((data.instance_nodes as typeof nodes)[1].result).toBe(existing)
  })
})