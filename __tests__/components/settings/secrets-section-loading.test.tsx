import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { SecretsSection } from "@/app/components/settings/SecretsSection"
import { createClient } from "@/lib/supabase/client"

jest.mock("@/app/context/SiteContext", () => ({ useSite: () => ({ currentSite: { id: "site-1" } }) }))
jest.mock("@/app/context/LocalizationContext", () => ({ useLocalization: () => ({ t: (key: string) => key }) }))
jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))

it("loads once across rerenders and reloads when the instance changes", async () => {
  const result = { data: [{ id: "secret-1", name: "Example", provider: "provider", use_case: "test", created_at: "2026-11-05" }], error: null }
  const query = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  const from = jest.fn(() => query)
  jest.mocked(createClient).mockReturnValue({ from } as unknown as ReturnType<typeof createClient>)
  const view = render(<SecretsSection />)
  await screen.findByText("Example")
  expect(from).toHaveBeenCalledTimes(1)
  expect(query.is).toHaveBeenCalledWith("instance_id", null)
  view.rerender(<SecretsSection />)
  expect(from).toHaveBeenCalledTimes(1)
  view.rerender(<SecretsSection instanceId="instance-2" />)
  await waitFor(() => expect(from).toHaveBeenCalledTimes(2))
  await screen.findByText("Example")
  expect(query.eq).toHaveBeenCalledWith("instance_id", "instance-2")
  expect(screen.getByRole("table").querySelectorAll("th")).toHaveLength(4)
  expect(screen.getByText("••••••••••••••••")).toBeInTheDocument()
})

it("reveals, hides and reuses a retrieved value without changing the API payload", async () => {
  const result = { data: [{ id: "secret-1", name: "Example", provider: "provider", use_case: "test", created_at: "2026-11-05" }], error: null }
  const query = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), is: jest.fn().mockResolvedValue(result) }
  jest.mocked(createClient).mockReturnValue({ from: () => query } as unknown as ReturnType<typeof createClient>)
  const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({ ok: true, json: async () => ({ secretValue: "test-value" }) } as Response)
  try {
    render(<SecretsSection />)
    const row = (await screen.findByText("Example")).closest("tr")!
    const reveal = within(row).getAllByRole("button")[0]
    fireEvent.click(reveal)
    await screen.findByText("test-value")
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      operation: "retrieve", siteId: "site-1", provider: "provider", useCase: "test",
    })
    fireEvent.click(reveal)
    expect(screen.queryByText("test-value")).not.toBeInTheDocument()
    fireEvent.click(reveal)
    expect(screen.getByText("test-value")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  } finally {
    fetchMock.mockRestore()
  }
})