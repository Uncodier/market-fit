import {
  getCommentContentHref, getConversationPostContext, getSafeSocialUrl,
  isSocialCommentMetadata, orderCommentMessages, parseSocialCommentContext, resolveCommentReplyContext,
} from "@/lib/chat/social-comment-context"
import type { ChatMessage } from "@/app/types/chat"

const metadata = {
  source: "comment", network: "instagram", publisher_account_id: "owned-1",
  outstand_post_id: "post-1", author_id: "reader-1", platform_comment_id: "comment-1",
  author_name: "Reader", platform_post_url: "https://www.instagram.com/p/post-1/",
}
const canonical = { ...metadata, comment_grouping_version: 1 }
const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "inbound", role: "user", text: "Exact question", timestamp: new Date("2026-10-01T12:00:00Z"),
  metadata, ...overrides,
})

describe("safe social comment metadata", () => {
  it.each([null, undefined, [], "comment", { source: "outstand_dm", outstand_post_id: "post" },
    { source: "email", outstand_post_id: "post" }])("does not treat non-comment metadata as a comment: %j", value => {
    expect(isSocialCommentMetadata(value)).toBe(false)
    expect(parseSocialCommentContext(value)).toBeUndefined()
  })

  it("normalizes only named fields, never the owned username as the participant", () => {
    expect(parseSocialCommentContext({ ...metadata, network: "TWITTER", author_id: 123,
      author_name: {}, author_username: [], social_handle: " ", username: "owned", publisher_username: "publisher", account_username: "publisher",
      post_title: [], content_id: {}, publisher_account_id: ["owned"], platform_comment_id: 456,
    })).toEqual(expect.objectContaining({
      network: "x", authorId: "123", commentId: "456", authorName: undefined,
      publisherUsername: "publisher", socialAccountId: undefined, contentId: undefined, postTitle: undefined,
    }))
    expect(parseSocialCommentContext({ ...metadata, network: "linkedin" })?.authorName).toBeUndefined()
  })

  it.each([
    "javascript:alert(1)", "data:text/html,hello", "http://instagram.com/p/one", "//instagram.com/p/one",
    "https://name:secret@instagram.com/p/one", "https://instagram.com:8443/p/one",
    "https://instagram.com.evil.example/p/one", "https://evilinstagram.com/p/one",
    "https://127.0.0.1/p/one", "https://localhost/p/one", "https://[::1]/p/one",
    "https://instagram.com\\@evil.example/", "https://instagram.com/\nunsafe", {}, [],
  ])("rejects unsafe social links: %j", value => { expect(getSafeSocialUrl(value)).toBeUndefined() })

  it("allows known HTTPS social origins and encodes internal search identifiers", () => {
    expect(getSafeSocialUrl(metadata.platform_post_url)).toBe(metadata.platform_post_url)
    expect(getSafeSocialUrl("https://m.facebook.com/posts/1")).toBe("https://m.facebook.com/posts/1")
    expect(getCommentContentHref("content-1")).toBe("/content/content-1")
    expect(getCommentContentHref("../../settings")).toBeUndefined()
    expect(getCommentContentHref(undefined, "post&site_id=foreign")).toBe("/content?search=post%26site_id%3Dforeign")
  })

  it("requires a complete canonical group and refuses conflicting or legacy global headers", () => {
    expect(getConversationPostContext(canonical, [message()])?.postId).toBe("post-1")
    expect(getConversationPostContext(metadata, [message()])).toBeUndefined()
    for (const key of ["publisher_account_id", "author_id", "outstand_post_id", "network"]) {
      expect(getConversationPostContext({ ...canonical, [key]: null }, [])).toBeUndefined()
    }
    for (const conflict of [
      { outstand_post_id: "post-2" }, { publisher_account_id: "owned-2" },
      { network: "facebook" }, { author_id: "another-reader" }, { source: "outstand_dm" },
    ]) expect(getConversationPostContext(canonical, [message({ metadata: { ...metadata, ...conflict } })])).toBeUndefined()
  })
})

describe("exact comment reply resolution", () => {
  const reply = message({ id: "reply", role: "assistant", text: "Response",
    metadata: { ...metadata, reply_to_message_id: "inbound", reply_to_comment_id: "comment-1" } })

  it("selects the explicit target rather than the closest comment or another owned account", () => {
    const later = message({ id: "later", text: "Wrong question", metadata: { ...metadata, platform_comment_id: "comment-2" } })
    expect(resolveCommentReplyContext(reply, [message(), later])).toEqual(expect.objectContaining({
      availability: "available", messageId: "inbound", text: "Exact question", authorName: "Reader",
    }))
    const foreign = message({ metadata: { ...metadata, publisher_account_id: "another-owned-account" } })
    expect(resolveCommentReplyContext(reply, [foreign])?.availability).toBe("unavailable")
  })

  it("uses a read-only exact preview when the parent is outside the visible page", () => {
    expect(resolveCommentReplyContext({ ...reply, replyContext: {
      availability: "available", messageId: "inbound", commentId: "comment-1", text: "Original question",
      url: "javascript:alert(1)",
    } }, [])).toEqual(expect.objectContaining({ availability: "available", text: "Original question", url: undefined }))
    expect(resolveCommentReplyContext({ ...reply, replyContext: {
      availability: "available", messageId: "someone-else", text: "Wrong question",
    } }, [])?.availability).toBe("unavailable")
  })

  it("requires full scope for provider-only IDs and fails closed on ambiguous matches", () => {
    const providerReply = { ...reply, metadata: { ...metadata, reply_to_comment_id: "comment-1" } }
    expect(resolveCommentReplyContext(providerReply, [message()])?.text).toBe("Exact question")
    expect(resolveCommentReplyContext(providerReply, [message(), message({ id: "duplicate" })])?.availability).toBe("unavailable")
    expect(resolveCommentReplyContext({ ...providerReply, metadata: { source: "comment", reply_to_comment_id: "comment-1" } },
      [message()])?.availability).toBe("unavailable")
  })

  it("never guesses unknown replies and leaves inbound top-level comments and DMs alone", () => {
    expect(resolveCommentReplyContext(message({ role: "assistant", metadata: undefined }), [message()], true)?.availability).toBe("unavailable")
    expect(resolveCommentReplyContext(message(), [])).toBeUndefined()
    expect(resolveCommentReplyContext({ ...reply, metadata: { source: "outstand_dm" } }, [message()], true)).toBeUndefined()
  })

  it("sorts comments chronologically without changing input or non-comment channel order", () => {
    const pending = message({ id: "pending", role: "assistant", timestamp: new Date("2026-10-01T12:05:00Z") })
    const input = [pending, message()]
    expect(orderCommentMessages(input).map(row => row.id)).toEqual(["inbound", "pending"])
    expect(input.map(row => row.id)).toEqual(["pending", "inbound"])
    expect(orderCommentMessages(input, { source: "outstand_dm" })).toBe(input)
    const email = input.map(row => ({ ...row, metadata: { source: "email" } }))
    expect(orderCommentMessages(email)).toBe(email)
  })

  it("groups exact replies under chronological roots with chronological siblings, not pending-first", () => {
    const a = message({ id: "a" })
    const b = message({ id: "b", timestamp: new Date("2026-10-01T12:01:00Z") })
    const replyA = message({ id: "reply-a", role: "assistant", timestamp: new Date("2026-10-01T12:03:00Z"),
      metadata: { ...metadata, reply_to_message_id: "a", status: "pending" } })
    const replyB = message({ id: "reply-b", role: "assistant", timestamp: new Date("2026-10-01T12:02:00Z"),
      metadata: { ...metadata, reply_to_message_id: "b", status: "pending" } })
    const secondReplyA = message({ id: "second-a", role: "team_member", timestamp: new Date("2026-10-01T12:04:00Z"),
      metadata: { ...metadata, reply_to_message_id: "a" } })
    expect(orderCommentMessages([secondReplyA, replyA, replyB, b, a]).map(row => row.id))
      .toEqual(["a", "reply-a", "second-a", "b", "reply-b"])
  })

  it("keeps absent targets independent and preserves every row once even in a malformed cycle", () => {
    const a = message({ id: "a", metadata: { ...metadata, reply_to_message_id: "b" } })
    const b = message({ id: "b", metadata: { ...metadata, reply_to_message_id: "a" } })
    const missing = message({ id: "missing", role: "assistant", metadata: { ...metadata, reply_to_message_id: "absent" } })
    const rows = orderCommentMessages([a, b, missing])
    expect(rows.map(row => row.id)).toEqual(["missing", "a", "b"])
    expect(new Set(rows).size).toBe(3)
  })
})