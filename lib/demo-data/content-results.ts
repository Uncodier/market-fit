const CAROUSEL_TEXT = [
  '1. Dashboards report problems. AI analytics helps teams act on them.',
  '2. Detect anomalies before they affect revenue or customer experience.',
  '3. Give every insight context: what changed, why it matters, and who should act.',
  '4. Automate routine follow-ups while keeping people in control of critical decisions.',
  '5. Measure outcomes, not just charts: faster decisions and fewer unresolved issues.',
].join('\n\n')

const CAROUSEL_NODE_IDS = new Set(['node-saas-3', 'node-habituall-3'])

/** Complete the known content fixtures; never synthesize results for real nodes. */
export function attachDemoContentResults(data: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(data.instance_nodes)) return data
  return {
    ...data,
    instance_nodes: data.instance_nodes.map((value: unknown) => {
      if (!value || typeof value !== 'object') return value
      const node = value as Record<string, unknown>
      if (!CAROUSEL_NODE_IDS.has(String(node.id)) || node.result) return node
      return { ...node, result: { text: CAROUSEL_TEXT } }
    }),
  }
}