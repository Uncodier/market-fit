import { StrictMode, useState } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LookupChipsInput } from '@/app/people/lookup-chips-input'
import type { LookupOption } from '@/app/people/finder-api'
import { deferred } from './test-helpers'

function Lookup({ fetcher }: { fetcher: (query: string) => Promise<LookupOption[]> }) {
  const [values, setValues] = useState<LookupOption[]>([])
  const [version, setVersion] = useState(0)
  return <>
    <button onClick={() => setValues([])}>Clear filters</button>
    <button onClick={() => setVersion(version + 1)}>Render {version}</button>
    <LookupChipsInput values={values} onChange={setValues} fetcher={q => fetcher(q)} />
  </>
}

const type = (value: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value } })
const advance = async (ms: number) => { await act(async () => { jest.advanceTimersByTime(ms) }) }

beforeEach(() => { jest.useFakeTimers() })
afterEach(() => {
  cleanup()
  jest.clearAllTimers()
  jest.useRealTimers()
})

it('debounces q → qu → que 80ms apart across child and parent renders', async () => {
  const fetcher = jest.fn().mockResolvedValue([{ id: 1, text: 'Query' }])
  render(<StrictMode><Lookup fetcher={fetcher} /></StrictMode>)
  type('q')
  await advance(80)
  fireEvent.click(screen.getByText('Render 0'))
  type('qu')
  await advance(80)
  fireEvent.click(screen.getByText('Render 1'))
  type('que')
  await advance(249)
  expect(fetcher).not.toHaveBeenCalled()
  await advance(1)
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher).toHaveBeenCalledWith('que')
  expect(screen.getByRole('button', { name: 'Query' })).toBeInTheDocument()
})

it('uses the latest inline fetcher without restarting the pending timer', async () => {
  const oldFetcher = jest.fn()
  const newFetcher = jest.fn().mockResolvedValue([])
  const view = render(<Lookup fetcher={oldFetcher} />)
  type(' q ')
  await advance(80)
  view.rerender(<Lookup fetcher={newFetcher} />)
  await advance(170)
  expect(oldFetcher).not.toHaveBeenCalled()
  expect(newFetcher).toHaveBeenCalledWith('q')
})

it.each(['', '   ', '\t'])('does not look up blank input %j and preserves one-character support', async blank => {
  const fetcher = jest.fn().mockResolvedValue([])
  render(<Lookup fetcher={fetcher} />)
  type('q')
  await advance(80)
  type(blank)
  await advance(500)
  expect(fetcher).not.toHaveBeenCalled()
  type(' q ')
  await advance(250)
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher).toHaveBeenCalledWith('q')
})

it.each(['clear filters', 'Enter', 'unmount'])('cancels queued lookup on %s', async action => {
  const fetcher = jest.fn().mockResolvedValue([])
  const view = render(<Lookup fetcher={fetcher} />)
  type('queued')
  await advance(80)
  if (action === 'clear filters') fireEvent.click(screen.getByText('Clear filters'))
  else if (action === 'Enter') fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
  else view.unmount()
  await advance(500)
  expect(fetcher).not.toHaveBeenCalled()
})

it.each(['input clear', 'clear filters', 'Enter', 'unmount'])('invalidates in-flight results on %s', async action => {
  const request = deferred<LookupOption[]>()
  const fetcher = jest.fn().mockReturnValueOnce(request.promise).mockResolvedValue([])
  const view = render(<Lookup fetcher={fetcher} />)
  type('old')
  await advance(250)
  expect(screen.getByText('Searching…')).toBeInTheDocument()
  if (action === 'input clear') type('')
  else if (action === 'clear filters') fireEvent.click(screen.getByText('Clear filters'))
  else if (action === 'Enter') fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
  else view.unmount()
  await act(async () => { request.resolve([{ id: 1, text: 'Obsolete' }]) })
  if (action !== 'unmount') type('new')
  expect(screen.queryByText('Obsolete')).not.toBeInTheDocument()
  expect(screen.queryByText('Searching…')).not.toBeInTheDocument()
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it.each(['resolve', 'reject'] as const)('ignores an old %s while the latest request is pending', async outcome => {
  const old = deferred<LookupOption[]>()
  const latest = deferred<LookupOption[]>()
  const fetcher = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
  render(<Lookup fetcher={fetcher} />)
  type('old')
  await advance(250)
  type('new')
  await advance(250)
  await act(async () => {
    if (outcome === 'resolve') old.resolve([{ id: 1, text: 'Old result' }])
    else old.reject(new Error('Old failure'))
  })
  expect(screen.getByText('Searching…')).toBeInTheDocument()
  expect(screen.queryByText('Old result')).not.toBeInTheDocument()
  await act(async () => { latest.resolve([{ id: 2, text: 'New result' }]) })
  expect(screen.getByRole('button', { name: 'New result' })).toBeInTheDocument()
  expect(screen.queryByText('Searching…')).not.toBeInTheDocument()
})

it.each(['resolve', 'reject'] as const)('does not overwrite newer results when an older request later %ss', async outcome => {
  const old = deferred<LookupOption[]>()
  const latest = deferred<LookupOption[]>()
  const fetcher = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
  render(<Lookup fetcher={fetcher} />)
  type('old')
  await advance(250)
  type('new')
  await advance(250)
  await act(async () => { latest.resolve([{ id: 2, text: 'New result' }]) })
  await act(async () => {
    if (outcome === 'resolve') old.resolve([{ id: 1, text: 'Old result' }])
    else old.reject(new Error('Old failure'))
  })
  expect(screen.getByRole('button', { name: 'New result' })).toBeInTheDocument()
  expect(screen.queryByText('Old result')).not.toBeInTheDocument()
})

it('invalidates old results during the debounce gap, before the new request starts', async () => {
  const old = deferred<LookupOption[]>()
  const fetcher = jest.fn().mockReturnValue(old.promise)
  render(<Lookup fetcher={fetcher} />)
  type('old')
  await advance(250)
  type('new')
  await act(async () => { old.resolve([{ id: 1, text: 'Old result' }]) })
  expect(screen.queryByText('Old result')).not.toBeInTheDocument()
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('selects provider IDs, clears suggestions, excludes existing chips and supports removal', async () => {
  const selected = { id: 42, text: 'Selected' }
  const fetcher = jest.fn().mockResolvedValue([selected])
  const onChange = jest.fn()
  const view = render(<LookupChipsInput values={[]} onChange={onChange} fetcher={fetcher} />)
  type('s')
  await advance(250)
  fireEvent.click(screen.getByRole('button', { name: 'Selected' }))
  expect(onChange).toHaveBeenCalledWith([selected])
  expect(screen.getByRole('textbox')).toHaveValue('')
  expect(screen.queryByRole('button', { name: 'Selected' })).not.toBeInTheDocument()
  view.rerender(<LookupChipsInput values={[selected]} onChange={onChange} fetcher={fetcher} />)
  type('s')
  await advance(250)
  expect(screen.queryByRole('button', { name: 'Selected' })).not.toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
  fireEvent.click(screen.getByRole('button', { name: 'Remove Selected' }))
  expect(onChange).toHaveBeenLastCalledWith([])
})

it('does not automatically retry a failure but allows another lookup', async () => {
  const fetcher = jest.fn().mockRejectedValueOnce(new Error('429')).mockResolvedValue([])
  render(<Lookup fetcher={fetcher} />)
  type('q')
  await advance(250)
  expect(screen.queryByText('Searching…')).not.toBeInTheDocument()
  await advance(5000)
  expect(fetcher).toHaveBeenCalledTimes(1)
  type('qu')
  await advance(250)
  expect(fetcher).toHaveBeenCalledTimes(2)
})