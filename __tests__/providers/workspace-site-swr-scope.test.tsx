import { useEffect, type ReactNode } from "react"
import { act, render, screen, waitFor } from "@testing-library/react"
import useSWR, { SWRConfig } from "swr"
import { WorkspaceSiteSWRScope } from "@/app/providers/WorkspaceSiteSWRScope"
import { SWRProvider } from "@/app/providers/swr-provider"

let mockLoading = true
jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ isLoading: mockLoading }) }))

const fetcher = jest.fn(async () => "Loaded")
function List({ name, objectKey = false }: { name: string; objectKey?: boolean }) {
  const { data, error, isLoading } = useSWR(
    objectKey ? { resource: name, siteId: "site" } : [name, "site"], fetcher,
  )
  return <div data-testid={name}>{isLoading ? "Loading" : error ? error.message : data}</div>
}
function Wrapper({ children }: { children: ReactNode }) {
  return <SWRProvider><SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
    <WorkspaceSiteSWRScope>{children}</WorkspaceSiteSWRScope>
  </SWRConfig></SWRProvider>
}

beforeEach(() => { mockLoading = true; fetcher.mockClear() })

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
    return <List name="inventory" />
  }
  const { rerender } = render(<Wrapper><Shell /></Wrapper>)
  mockLoading = false
  rerender(<Wrapper><Shell /></Wrapper>)
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  mockLoading = true
  rerender(<Wrapper><Shell /></Wrapper>)
  expect(cleanup).not.toHaveBeenCalled()
  expect(screen.getByTestId("inventory")).toHaveTextContent("Loading")
})