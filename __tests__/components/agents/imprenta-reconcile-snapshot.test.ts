import { createRecoveryCadence, reconcileSnapshot } from '@/app/components/agents/imprenta-panel/reconcile-snapshot'

it('does not invalidate cards for unchanged recovery snapshots', () => {
  const rows = [{ id: 'a', status: 'running', settings: { x: 1 } }, { id: 'b', status: 'completed', settings: {} }]
  expect(reconcileSnapshot(rows, JSON.parse(JSON.stringify(rows)))).toBe(rows)
  const changed = reconcileSnapshot(rows, [{ ...rows[0], status: 'completed' }, { ...rows[1] }])
  expect(changed[0]).not.toBe(rows[0])
  expect(changed[1]).toBe(rows[1])
  expect(reconcileSnapshot(rows, [rows[1]])).toEqual([rows[1]])
})

it('backs off unchanged running snapshots but restores fast recovery for changes', () => {
  const cadence = createRecoveryCadence()
  cadence.observe([{ id: 'a', status: 'running' }], [], 15000)
  expect(cadence.due(30000)).toBe(true)
  cadence.observe([{ id: 'a', status: 'running' }], [], 30000)
  expect(cadence.due(45000)).toBe(false)
  expect(cadence.due(60000)).toBe(true)
  cadence.observe([{ id: 'a', status: 'running' }], [], 60000)
  expect(cadence.due(75000)).toBe(false)
  cadence.reset()
  expect(cadence.due(75000)).toBe(true)
})