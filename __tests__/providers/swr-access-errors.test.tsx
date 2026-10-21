import type { ReactNode } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import useSWR, { SWRConfig } from "swr"
import { SWRProvider } from "@/app/providers/swr-provider"

function Wrapper({ children }: { children: ReactNode }) {
  return <SWRProvider><SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0,
    revalidateOnFocus: false }}>{children}</SWRConfig></SWRProvider>
}

afterEach(() => jest.useRealTimers())

it.each(["Forbidden", "Not authenticated"])("shows %s immediately and never automatically retries", async message => {
  jest.useFakeTimers()
  const fetcher = jest.fn(async () => { throw new Error(message) })
  function List() {
    const { error, isLoading } = useSWR(["secured", message], fetcher)
    return <div>{isLoading ? "Loading" : error?.message}</div>
  }
  render(<Wrapper><List /></Wrapper>)
  expect(await screen.findByText(message)).toBeInTheDocument()
  await act(async () => { jest.advanceTimersByTime(30000) })
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it("does not keep showing cached data after a refresh denies access", async () => {
  const fetcher = jest.fn().mockResolvedValueOnce("Private data")
    .mockRejectedValue(new Error("Forbidden"))
  function List() {
    const { data, error, mutate } = useSWR("secured-refresh", fetcher)
    return <>{error ? <div role="alert">{error.message}</div> : <div>{data}</div>}
      <button onClick={() => { void mutate() }}>Refresh</button></>
  }
  render(<Wrapper><List /></Wrapper>)
  expect(await screen.findByText("Private data")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Refresh" }))
  expect(await screen.findByRole("alert")).toHaveTextContent("Forbidden")
  expect(screen.queryByText("Private data")).not.toBeInTheDocument()
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
})