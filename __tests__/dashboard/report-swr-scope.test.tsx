import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import useSWR, { SWRConfig, type Middleware } from "swr"
import { ReportSWRScope } from "@/app/dashboard/ReportSWRScope"

const maskErrors: Middleware = (next) => (key, fetcher, config) => {
  const result = next(key, fetcher, config)
  return { ...result, error: undefined }
}

it("keeps report refresh failures visible despite inherited app error-masking middleware", async () => {
  let fail = false
  const fetcher = jest.fn(async () => {
    if (fail) throw new Error("Report unavailable")
    return 42
  })
  function Report() {
    const { data, error, mutate } = useSWR("report-key", fetcher)
    return <>
      {error ? <div role="alert">Report unavailable</div> : <div>{data}</div>}
      <button onClick={() => { void mutate() }}>Refresh</button>
    </>
  }
  render(<SWRConfig value={{ use: [maskErrors], keepPreviousData: true }}>
    <ReportSWRScope><Report /></ReportSWRScope>
  </SWRConfig>)
  expect(await screen.findByText("42")).toBeInTheDocument()
  fail = true
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Refresh" })) })
  expect(await screen.findByRole("alert")).toHaveTextContent("Report unavailable")
  expect(screen.queryByText("42")).not.toBeInTheDocument()
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
})