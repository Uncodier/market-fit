import { fireEvent, render, screen } from '@testing-library/react'
import { TaskConnectorAuthorization } from '@/app/components/workflows/task-connector-authorization'

jest.mock('@/app/connectors/tool-catalog-search', () => ({ ToolCatalogSearch: ({ slug, onSelect }: { slug: string; onSelect: (id: string) => void }) =>
  <button onClick={() => onSelect(`${slug.toUpperCase()}_SEARCH`)}>Select catalog entry</button> }))
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const props = { siteId: id(1), instanceId: id(2), nodeId: id(3), selectedId: id(4) }
const reply = (value: unknown) => ({ ok: true, json: async () => value })
const original = global.fetch
afterEach(() => { global.fetch = original })

it.each(['observatory', 'warehouse'])('reviews the live %s descriptor and exact arguments before publishing', async toolkit => {
  const tool_slug = `${toolkit.toUpperCase()}_SEARCH`
  const description = { connector_id: id(4), toolkit_slug: toolkit, tool_slug, schema_hash: 'a'.repeat(64), toolkit_version: '20261201_02', input_schema: { type: 'object' } }
  const review = { ...description, instance_id: id(2), node_id: id(3), trigger_id: id(5), principal_id: id(6), operation: tool_slug,
    arguments: { filter: 'active' }, cron: '0 * * * *', timezone: 'UTC', digest: 'b'.repeat(64), published: false }
  const fetcher = jest.fn().mockResolvedValueOnce(reply(description)).mockResolvedValueOnce(reply(review)).mockResolvedValueOnce(reply({...review, published: true}))
    .mockResolvedValueOnce(reply({executed:true,report:{title:'Private result',note:'Redacted',columns:['Field','Value'],rows:[['$.name','example row']]}}))
  global.fetch = fetcher
  render(<TaskConnectorAuthorization {...props} toolkit={toolkit} />)
  expect(screen.queryByText('Authorize and publish')).toBeNull()
  fireEvent.click(screen.getByText('Choose catalog action')); fireEvent.click(screen.getByText('Select catalog entry')); fireEvent.click(screen.getByText('Check action'))
  fireEvent.change(await screen.findByLabelText('Arguments (JSON)'), { target: { value: '{"filter":"active"}' } })
  fireEvent.click(screen.getByText('Review schedule')); fireEvent.click(await screen.findByText('Authorize and publish'))
  await screen.findByText(/Published ·/)
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ site_id:id(1),instance_id:id(2),node_id:id(3),action:'publish',tool_slug,arguments:review.arguments,digest:review.digest })
  fireEvent.click(screen.getByText('View private result')); expect(await screen.findByText('example row')).toBeVisible()
})

it('refuses an unconfirmed action and does not retry or publish it', async () => {
  global.fetch = jest.fn().mockResolvedValue(reply({tool_slug:'OTHER_READ'}))
  render(<TaskConnectorAuthorization {...props} toolkit="observatory" />)
  fireEvent.click(screen.getByText('Choose catalog action')); fireEvent.click(screen.getByText('Select catalog entry')); fireEvent.click(screen.getByText('Check action'))
  await screen.findByText(/Could not confirm/)
  expect(screen.queryByText('Review schedule')).toBeNull(); expect(global.fetch).toHaveBeenCalledTimes(1)
})
