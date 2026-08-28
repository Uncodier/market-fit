import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { DestinationSelector } from "@/app/components/commerce/DestinationSelector"

const fromMock = jest.fn()

jest.mock("../../../lib/supabase/client", () => ({
  createClient: () => ({ from: fromMock }),
}))

jest.mock("@/app/components/auth/auth-provider", () => ({
  useAuthContext: () => ({ user: { id: "user-1" } }),
}))

jest.mock("@/app/context/LocalizationContext", () => ({
  useLocalization: () => ({
    t: (key: string) => key,
  }),
}))

function mockSitesQuery(rows: { id: string; name: string }[]) {
  const result = { data: rows, error: null }
  const query: Record<string, unknown> = {}
  query.select = jest.fn(() => query)
  query.eq = jest.fn(() => query)
  query.then = (onFulfilled: unknown, onRejected: unknown) =>
    Promise.resolve(result).then(onFulfilled as never, onRejected as never)
  return query
}

describe("DestinationSelector", () => {
  beforeEach(() => {
    fromMock.mockReset()
    fromMock.mockImplementation(() =>
      mockSitesQuery([{ id: "site-1", name: "Corebooks" }])
    )
  })

  it("does not reload sites when the selected destination changes", async () => {
    const onChange = jest.fn()
    const { rerender } = render(
      <DestinationSelector value={null} onChange={onChange} />
    )

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument()
    })

    const callsAfterLoad = fromMock.mock.calls.length
    expect(callsAfterLoad).toBeGreaterThan(0)

    rerender(<DestinationSelector value="site-1" onChange={onChange} />)

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument()
    })

    expect(fromMock.mock.calls.length).toBe(callsAfterLoad)
  })
})
