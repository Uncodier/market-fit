import { useEffect, type ReactNode } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import useSWR, { SWRConfig } from "swr"
import { WorkspaceSiteSWRScope } from "@/app/providers/WorkspaceSiteSWRScope"
import { SWRProvider } from "@/app/providers/swr-provider"
import { AuthContext, type AuthContextValue } from "@/app/components/auth/auth-context"

let mockLoading = true
let mockSiteId = 'site'
let mockActorId = 'actor'
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ isLoading: mockLoading, currentSite: { id: mockSiteId } }) }))

const fetcher = jest.fn(async () => "Loaded")
function List({ name, objectKey = false }: { name: string; objectKey?: boolean }) {
  const { data, error, isLoading, mutate } = useSWR(
    objectKey ? { resource: name, siteId: mockSiteId } : [name, mockSiteId], fetcher,
  )
  return <><div data-testid={name}>{isLoading ? "Loading" : error ? error.message : data}</div>
    <button onClick={() => { void mutate() }}>Refresh {name}</button></>
}
function Wrapper({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={{ user: { id: mockActorId } } as AuthContextValue}><SWRProvider><SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <WorkspaceSiteSWRScope>{children}</WorkspaceSiteSWRScope>
  </SWRConfig></SWRProvider></AuthContext.Provider>
}

beforeEach(() => { mockLoading = true; mockSiteId = 'site'; mockActorId = 'actor'; fetcher.mockReset(); fetcher.mockResolvedValue('Loaded') })

it("holds array, object, and URL workspace requests until the site finishes loading", async () => {
  function UrlList() {
    const { data, isLoading } = useSWR("/api/site-data?siteId=site", fetcher)
    return <div data-testid="url">{isLoading ? "Loading" : data}</div>
  }
  const { rerender } = render(<Wrapper><List name="sales" /><List name="catalog" objectKey /><UrlList /></Wrapper>)
  await act(async () => {})
  expect(fetcher).not.toHaveBeenCalled()
  for (const name of ["sales", "catalog", "url"]) expect(screen.getByTestId(name)).toHaveTextContent("Loading")
  mockLoading = false
  rerender(<Wrapper><List name="sales" /><List name="catalog" objectKey /><UrlList /></Wrapper>)
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
  for (const name of ["sales", "catalog", "url"]) expect(screen.getByTestId(name)).toHaveTextContent("Loaded")
})

it("does not unmount interactive children while site loading changes", async () => {
  const cleanup = jest.fn()
  function Shell() {
    useEffect(() => cleanup, [])
    return <><List name="inventory" /><input aria-label="Draft" defaultValue="" /></>
  }
  const { rerender } = render(<Wrapper><Shell /></Wrapper>)
  mockLoading = false
  rerender(<Wrapper><Shell /></Wrapper>)
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Unsaved work' } })
  mockLoading = true
  rerender(<Wrapper><Shell /></Wrapper>)
  expect(cleanup).not.toHaveBeenCalled()
  expect(screen.getByTestId("inventory")).toHaveTextContent("Loaded")
  expect(screen.getByLabelText('Draft')).toHaveValue('Unsaved work')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('resumes two readers of the same key with one request, not one mutate per subscriber', async () => {
  const tree = <Wrapper><List name="shared" /><List name="shared" /></Wrapper>
  const view = render(tree)
  expect(fetcher).not.toHaveBeenCalled()
  mockLoading = false
  view.rerender(<Wrapper><List name="shared" /><List name="shared" /></Wrapper>)
  await waitFor(() => expect(screen.getAllByText('Loaded')).toHaveLength(2))
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it('does not revalidate twice when a conditional SWR key first becomes usable at hydration', async () => {
  function Conditional() {
    const { data } = useSWR(mockLoading ? null : ['locations', mockSiteId], fetcher)
    return <p>{data}</p>
  }
  const view = render(<Wrapper><Conditional /></Wrapper>)
  expect(fetcher).not.toHaveBeenCalled()
  mockLoading = false
  view.rerender(<Wrapper><Conditional /></Wrapper>)
  await screen.findByText('Loaded')
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it.each(['site', 'actor', 'resource'])('does not retain data across a changed %s while paused', async change => {
  mockLoading = false
  const { rerender } = render(<Wrapper><List name="inventory" /></Wrapper>)
  await screen.findByText('Loaded')
  mockLoading = true
  if (change === 'site') mockSiteId = 'other-site'
  if (change === 'actor') mockActorId = 'other-actor'
  const name = change === 'resource' ? 'other-resource' : 'inventory'
  rerender(<Wrapper><List name={name} /></Wrapper>)
  expect(screen.getByTestId(name)).toHaveTextContent('Loading')
  expect(screen.queryByText('Loaded')).not.toBeInTheDocument()
})

it('does not carry previous data into an uncached site after loading finishes', async () => {
  mockLoading = false
  const { rerender } = render(<Wrapper><List name="inventory" /></Wrapper>)
  await screen.findByText('Loaded')
  mockSiteId = 'other-site'
  fetcher.mockReturnValue(new Promise(() => {}))
  rerender(<Wrapper><List name="inventory" /></Wrapper>)
  expect(screen.getByTestId('inventory')).toHaveTextContent('Loading')
  expect(screen.queryByText('Loaded')).not.toBeInTheDocument()
})

it('does not reuse a different actor cache after site loading finishes', async () => {
  mockLoading = false
  const { rerender } = render(<Wrapper><List name="inventory" /></Wrapper>)
  await screen.findByText('Loaded')
  mockActorId = 'other-actor'
  mockLoading = true
  rerender(<Wrapper><List name="inventory" /></Wrapper>)
  fetcher.mockReturnValue(new Promise(() => {}))
  mockLoading = false
  rerender(<Wrapper><List name="inventory" /></Wrapper>)
  expect(screen.queryByText('Loaded')).not.toBeInTheDocument()
})

it('does not resurrect data after a confirmed denial when site loading restarts', async () => {
  mockLoading = false
  const { rerender } = render(<Wrapper><List name="inventory" /></Wrapper>)
  await screen.findByText('Loaded')
  fetcher.mockRejectedValue(new Error('Forbidden'))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh inventory' }))
  await screen.findByText('Forbidden')
  mockLoading = true
  rerender(<Wrapper><List name="inventory" /></Wrapper>)
  expect(screen.queryByText('Loaded')).not.toBeInTheDocument()
})

it('removes retained data when an in-flight denial arrives during site loading', async () => {
  mockLoading = false
  const { rerender } = render(<Wrapper><List name="inventory" /></Wrapper>)
  await screen.findByText('Loaded')
  let reject!: (error: Error) => void
  fetcher.mockReturnValueOnce(new Promise((_, fail) => { reject = fail }))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh inventory' }))
  mockLoading = true
  rerender(<Wrapper><List name="inventory" /></Wrapper>)
  expect(screen.getByTestId('inventory')).toHaveTextContent('Loaded')
  await act(async () => reject(Object.assign(new Error('Forbidden'), { status: 403 })))
  expect(screen.queryByText('Loaded')).not.toBeInTheDocument()
  expect(screen.getByTestId('inventory')).toHaveTextContent('Forbidden')
})

it('preserves visible data through background transport failure and subsequent site refresh', async () => {
  mockLoading = false
  const { rerender } = render(<Wrapper><List name="inventory" /></Wrapper>)
  await screen.findByText('Loaded')
  fetcher.mockRejectedValue(new TypeError('Failed to fetch'))
  fireEvent.click(screen.getByRole('button', { name: 'Refresh inventory' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
  expect(screen.getByTestId('inventory')).toHaveTextContent('Loaded')
  mockLoading = true
  rerender(<Wrapper><List name="inventory" /></Wrapper>)
  expect(screen.getByTestId('inventory')).toHaveTextContent('Loaded')
})

it.each(['denial snapshot', 'explicit clear'])('does not mask an inbox %s with retained rows during site loading', async mode => {
  mockLoading = false
  type Page = { rows: string; denial?: { status: number } }
  const read = async (): Promise<Page> => ({ rows: 'private row' })
  function Inbox() {
    const { data, mutate } = useSWR(['conversations', mockSiteId, 'all', '', mockActorId], read)
    return <><span>{data?.denial ? 'denied' : data?.rows ?? 'pending'}</span>
      <button onClick={() => { void mutate(mode === 'explicit clear' ? undefined : { rows: '', denial: { status: 403 } }, false) }}>Invalidate</button></>
  }
  const view = render(<Wrapper><Inbox /></Wrapper>)
  await screen.findByText('private row')
  mockLoading = true
  view.rerender(<Wrapper><Inbox /></Wrapper>)
  expect(screen.getByText('private row')).toBeVisible()
  fireEvent.click(screen.getByText('Invalidate'))
  await screen.findByText(mode === 'explicit clear' ? 'pending' : 'denied')
  expect(screen.queryByText('private row')).toBeNull()
})
