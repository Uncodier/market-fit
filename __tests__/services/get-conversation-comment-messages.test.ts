import { createClient } from "@/lib/supabase/client"
import { getConversationMessages } from "@/app/services/getConversationMessages.client"

jest.mock("@/lib/supabase/client", () => ({ createClient: jest.fn() }))
const parentId = "10000000-0000-4000-8000-000000000001"
const metadata = { source: "comment", network: "instagram", publisher_account_id: "owned", outstand_post_id: "post", author_id: "reader" }
const row = (id: string, content: string, created_at: string, custom_data: object, role = "user") => ({ id, content, created_at, custom_data, role })

function query(data: unknown, error: unknown = null) {
  const result = {
    select: jest.fn(), eq: jest.fn(), in: jest.fn(), or: jest.fn(), order: jest.fn(), limit: jest.fn(), maybeSingle: jest.fn(),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error }).then(resolve),
  }
  for (const name of ["select", "eq", "in", "or", "order", "limit", "maybeSingle"] as const) result[name].mockReturnValue(result)
  return result
}

function setup(queries: ReturnType<typeof query>[]) {
  const from = jest.fn()
  queries.forEach(value => from.mockReturnValueOnce(value))
  jest.mocked(createClient).mockReturnValue({ from } as ReturnType<typeof createClient>)
  return from
}

beforeEach(() => jest.clearAllMocks())

it("loads the newest comment page, retains pending replies chronologically and reads exact absent parents without adding timeline rows", async () => {
  const conversation = query({ custom_data: { ...metadata, comment_grouping_version: 1 } })
  const pending = query([row("response", "Answer", "2026-10-01T12:03:00Z", { ...metadata, status: "pending",
    reply_to_message_id: parentId, reply_to_comment_id: "comment-1" }, "assistant")])
  const latest = query([row("newest", "Latest question", "2026-10-01T12:02:00Z", { ...metadata, platform_comment_id: "comment-2" })])
  const parent = query([row(parentId, "Exact old question", "2026-09-01T12:00:00Z", { ...metadata, platform_comment_id: "comment-1" })])
  setup([conversation, pending, latest, parent])

  const messages = await getConversationMessages("conversation-1")
  expect(latest.order).toHaveBeenCalledWith("created_at", { ascending: false })
  expect(latest.limit).toHaveBeenCalledWith(40)
  expect(parent.eq).toHaveBeenCalledWith("conversation_id", "conversation-1")
  expect(parent.in).toHaveBeenCalledWith("id", [parentId])
  expect(messages.map(message => message.id)).toEqual(["newest", "response"])
  expect(messages[1].replyContext).toEqual(expect.objectContaining({
    availability: "available", messageId: parentId, text: "Exact old question",
  }))
})

it.each([[], null])("keeps missing or failed parent context explicitly unavailable without suppressing responses: %j", parentRows => {
  setup([query({ custom_data: metadata }), query([row("response", "Answer", "2026-10-01T12:03:00Z", {
    ...metadata, reply_to_message_id: parentId, reply_to_comment_id: "missing", status: "pending",
  }, "assistant")]), query([]), query(parentRows, parentRows === null ? { code: "42501" } : null)])
  return expect(getConversationMessages("conversation-1")).resolves.toEqual([
    expect.objectContaining({ text: "Answer", replyContext: expect.objectContaining({ availability: "unavailable" }) }),
  ])
})

it("does not use a returned mismatched parent identity", async () => {
  setup([query({ custom_data: metadata }), query([row("response", "Answer", "2026-10-01T12:03:00Z", {
    ...metadata, reply_to_message_id: parentId, reply_to_comment_id: "comment-1",
  }, "assistant")]), query([]), query([row(parentId, "Other account", "2026-09-01T12:00:00Z", {
    ...metadata, publisher_account_id: "foreign-owned", platform_comment_id: "comment-1",
  })])])
  expect((await getConversationMessages("conversation-1"))[0].replyContext?.availability).toBe("unavailable")
})

it("detects legacy comment pages without treating them as canonical single-post groups", async () => {
  const latest = query([row("new", "Newest comment", "2026-10-01T12:00:00Z", metadata)])
  setup([query({ custom_data: { channel: "instagram" } }), query([]),
    query([row("old", "Oldest comment", "2026-09-01T12:00:00Z", metadata)]), latest])
  expect((await getConversationMessages("legacy"))[0].id).toBe("new")
  expect(latest.order).toHaveBeenCalledWith("created_at", { ascending: false })
})

it("uses a bounded conversation-scoped probe when older legacy history contains no comment metadata", async () => {
  const probe = query([{ id: "later-comment" }])
  const latest = query([row("new", "Latest comment", "2026-10-01T12:00:00Z", metadata)])
  setup([query({ custom_data: null }), query([]),
    query([row("old", "Old history", "2026-09-01T12:00:00Z", {})]), probe, latest])
  expect((await getConversationMessages("legacy"))[0].id).toBe("new")
  expect(probe.eq).toHaveBeenCalledWith("conversation_id", "legacy")
  expect(probe.eq).toHaveBeenCalledWith("role", "user")
  expect(probe.eq).toHaveBeenCalledWith("custom_data->>source", "comment")
  expect(probe.limit).toHaveBeenCalledWith(1)
  expect(latest.order).toHaveBeenCalledWith("created_at", { ascending: false })
})

it("preserves source-less non-comment order when the bounded probe finds no comments", async () => {
  const history = query([row("earlier", "Earlier", "2026-10-01T12:00:00Z", {})])
  const from = setup([query({ custom_data: null }),
    query([row("pending", "Pending", "2026-10-01T12:10:00Z", { status: "pending" }, "assistant")]), history, query([])])
  expect((await getConversationMessages("legacy-web")).map(message => message.id)).toEqual(["pending", "earlier"])
  expect(from).toHaveBeenCalledTimes(4)
  expect(history.order).toHaveBeenCalledWith("created_at", { ascending: true })
})

it.each(["outstand_dm", "email", "website_chat"])("preserves non-comment pending-first display and original page direction for %s", source => {
  const pending = query([row("pending", "Pending", "2026-10-01T12:10:00Z", { source, status: "pending" }, "assistant")])
  const history = query([row("earlier", "Earlier", "2026-10-01T12:00:00Z", { source })])
  const from = setup([query({ custom_data: { source } }), pending, history])
  return getConversationMessages("non-comment").then(messages => {
    expect(messages.map(message => message.id)).toEqual(["pending", "earlier"])
    expect(history.order).toHaveBeenCalledWith("created_at", { ascending: true })
    expect(from).toHaveBeenCalledTimes(3)
    expect(messages.every(message => !message.replyContext)).toBe(true)
  })
})

it("does not query messages when conversation access fails", async () => {
  const from = setup([query(null, { code: "42501" })])
  await expect(getConversationMessages("foreign-conversation")).rejects.toMatchObject({ code: "42501", message: "Unable to load conversation messages" })
  expect(from).toHaveBeenCalledTimes(1)
})

it.each(["pending", "history"])("propagates %s failures rather than returning an empty successful window", async failed => {
  const error = { code: "42501", message: "Private database detail", details: "Private policy detail" }
  const pending = query([], failed === "pending" ? error : null)
  const history = query([], failed === "history" ? error : null)
  setup([query({ custom_data: { source: "website_chat" } }), pending, history])
  await expect(getConversationMessages("conversation")).rejects.toMatchObject({ code: "42501", message: "Unable to load conversation messages" })
  expect(pending.limit).toHaveBeenCalledWith(1000)
  expect(history.limit).toHaveBeenCalledWith(40)
})

it("physically aborts the SDK signal while retaining the read until actual settlement", async () => {
  jest.useFakeTimers()
  try {
    let settle!: (value: unknown) => void
    const deferred = new Promise(resolve => { settle = resolve })
    let signal!: AbortSignal
    const conversation = query(null)
    conversation.then = resolve => deferred.then(resolve)
    const abortSignal = jest.fn((value: AbortSignal) => { signal = value; return conversation })
    setup([Object.assign(conversation, { abortSignal })])
    const read = getConversationMessages("slow", { timeoutMs: 25 })
    let settled = false
    const result = read.catch(error => { settled = true; return error })
    await jest.advanceTimersByTimeAsync(30)
    expect(signal.aborted).toBe(true)
    expect(settled).toBe(false)
    settle({ data: { custom_data: {} }, error: null })
    expect(await result).toMatchObject({ code: "57014", message: "Unable to load conversation messages" })
    expect(jest.getTimerCount()).toBe(0)
  } finally {
    jest.useRealTimers()
  }
})

it("waits for both physical fanout reads when one transport rejects early", async () => {
  let settle!: (value: unknown) => void
  const deferred = new Promise(resolve => { settle = resolve })
  const pending = query([])
  Object.assign(pending, { then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.reject({ code: "42501", message: "Private detail" }).then(resolve, reject) })
  const history = query([])
  history.then = resolve => deferred.then(resolve)
  setup([query({ custom_data: { source: "website_chat" } }), pending, history])
  let settled = false
  const result = getConversationMessages("conversation").catch(error => { settled = true; return error })
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(settled).toBe(false)
  settle({ data: [], error: null })
  expect(await result).toMatchObject({ code: "42501", message: "Unable to load conversation messages" })
})