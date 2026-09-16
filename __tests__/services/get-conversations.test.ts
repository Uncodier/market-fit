import { getConversations } from "@/app/services/getConversations.client"
import { createClient } from "../../lib/supabase/client"

jest.mock("../../lib/supabase/client", () => ({
  createClient: jest.fn(),
}))

interface QueryResponse {
  data?: unknown[] | null
  error?: unknown
  count?: number | null
}

function createQueryBuilder(response: QueryResponse) {
  const builder: any = {
    select: jest.fn(),
    eq: jest.fn(),
    neq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    range: jest.fn(),
    or: jest.fn(),
    ilike: jest.fn(),
    in: jest.fn(),
    in_: jest.fn(),
  }

  for (const method of [
    "select",
    "eq",
    "neq",
    "order",
    "limit",
    "range",
    "or",
    "ilike",
    "in",
    "in_",
  ]) {
    builder[method].mockReturnValue(builder)
  }

  builder.then = (resolve: (value: QueryResponse) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(response).then(resolve, reject)

  return builder
}

describe("getConversations", () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined)

  afterEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    consoleError.mockRestore()
  })

  it("rejects a failed list request so SWR can retry it", async () => {
    const requestError = {
      code: "57014",
      message: "canceling statement due to statement timeout",
    }
    const pendingQuery = createQueryBuilder({ data: [], error: null })
    const nonPendingQuery = createQueryBuilder({ data: null, error: requestError })
    const pendingCountQuery = createQueryBuilder({
      count: 0,
      error: null,
    })

    jest.mocked(createClient).mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(pendingQuery)
        .mockReturnValueOnce(nonPendingQuery)
        .mockReturnValueOnce(pendingCountQuery),
    } as ReturnType<typeof createClient>)

    await expect(getConversations("site-1")).rejects.toBe(requestError)
  })

  it("limits the embedded latest message to one row", async () => {
    const pendingQuery = createQueryBuilder({ data: [], error: null })
    const nonPendingQuery = createQueryBuilder({ data: [], error: null })
    const pendingCountQuery = createQueryBuilder({
      count: 0,
      error: null,
    })

    jest.mocked(createClient).mockReturnValue({
      from: jest
        .fn()
        .mockReturnValueOnce(pendingQuery)
        .mockReturnValueOnce(nonPendingQuery)
        .mockReturnValueOnce(pendingCountQuery),
    } as ReturnType<typeof createClient>)

    await expect(getConversations("site-1")).resolves.toEqual([])

    expect(nonPendingQuery.limit).toHaveBeenCalledWith(1, {
      referencedTable: "latest_message",
    })
    expect(nonPendingQuery.select.mock.calls[0][0]).toContain(
      "latest_message:messages"
    )
  })
})
