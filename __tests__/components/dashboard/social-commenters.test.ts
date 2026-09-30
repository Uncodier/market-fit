import { aggregateTopCommenters } from "@/app/components/dashboard/social-commenters"

describe("top commenter normalization", () => {
  it("reads the flat ingestion contract and groups repeated authors across posts", () => {
    const metadata = {
      source: "comment", author_id: "123", author_name: "Ada Reader", social_handle: "ada.reader",
      profile_url: "https://example.com/ada", username: "owned.account", outstand_post_id: "post-1",
    }
    expect(aggregateTopCommenters([
      { custom_data: metadata, conversations: { channel: "instagram" } },
      { custom_data: { ...metadata, outstand_post_id: "post-2" }, conversations: [{ channel: "instagram" }] },
    ])).toEqual([{ id: "author:instagram:123", name: "Ada Reader", avatar: null, count: 2 }])
  })

  it("falls back to social_handle for older normalized rows without author_name", () => {
    expect(aggregateTopCommenters([{
      custom_data: { source: "comment", author_id: 123, social_handle: "ada.reader", username: "owned.account" },
      conversations: { channel: "instagram" },
    }])).toEqual([{ id: "author:instagram:123", name: "ada.reader", avatar: null, count: 1 }])
  })

  it.each(["author", "from"])("supports legacy nested %s and shares identity with flat metadata", (field) => {
    expect(aggregateTopCommenters([
      { custom_data: { [field]: { id: 123, name: "Ada", avatar: "https://example.com/avatar.png" }, network: "Instagram" } },
      { custom_data: { author_id: "123", author_name: "Ada" }, conversations: { channel: "instagram" } },
    ])).toEqual([{ id: "author:instagram:123", name: "Ada", avatar: "https://example.com/avatar.png", count: 2 }])
  })

  it.each(["author", "from"])("retains legacy string %s names", (field) => {
    expect(aggregateTopCommenters([{ custom_data: { [field]: "Ada", origin: "instagram" } }]))
      .toEqual([{ id: "name:instagram:Ada", name: "Ada", avatar: null, count: 1 }])
  })

  it("does not merge equal external IDs on different networks, even with a shared lead", () => {
    const rows = ["instagram", "facebook", "instagram"].map((channel) => ({
      custom_data: { author_id: "123", author_name: "Ada", origin: "outstand" },
      conversations: { channel }, lead_id: "shared-lead",
    }))
    expect(aggregateTopCommenters(rows)).toEqual([
      { id: "author:instagram:123", name: "Ada", avatar: null, count: 2 },
      { id: "author:facebook:123", name: "Ada", avatar: null, count: 1 },
    ])
  })

  it("uses metadata network/channel/origin when the conversation channel is unavailable", () => {
    const rows = ["network", "channel", "origin"].map((field) => ({
      custom_data: { [field]: " Instagram ", author_id: "123", social_handle: "ada" },
    }))
    expect(aggregateTopCommenters(rows)).toEqual([
      { id: "author:instagram:123", name: "ada", avatar: null, count: 3 },
    ])
  })

  it("prefers the normalized metadata channel over the legacy conversation default", () => {
    const custom_data = { author_id: "123", author_name: "Ada", channel: "instagram" }
    expect(aggregateTopCommenters([
      { custom_data, conversations: { channel: "website" } },
      { custom_data: { ...custom_data, channel: " " }, conversations: { channel: "instagram" } },
      { custom_data: { author_id: "123", author_name: "Ada" }, conversations: { channel: "instagram" } },
    ])).toEqual([{ id: "author:instagram:123", name: "Ada", avatar: null, count: 3 }])
  })

  it("merges twitter and x aliases into the same provider identity", () => {
    const author = { author_id: "123", author_name: "Ada" }
    expect(aggregateTopCommenters([
      { custom_data: { ...author, network: " Twitter " } },
      { custom_data: { ...author, channel: "x" } },
      { custom_data: author, conversations: { channel: "twitter" } },
      { custom_data: { ...author, origin: "X" } },
    ])).toEqual([{ id: "author:x:123", name: "Ada", avatar: null, count: 4 }])
  })

  it("prefers a synchronized author name over an earlier handle-only row", () => {
    const custom_data = { author_id: "123", social_handle: "ada.reader" }
    expect(aggregateTopCommenters([
      { custom_data },
      { custom_data: { author_id: "123", author_name: "Ada Reader" } },
      { custom_data },
    ])).toEqual([{ id: "author:unknown:123", name: "Ada Reader", avatar: null, count: 3 }])
  })

  it("reuses lead and visitor fallbacks without merging unrelated anonymous commenters", () => {
    const custom_data = { username: "owned.account", source: "comment", outstand_post_id: "post-1" }
    expect(aggregateTopCommenters([
      { custom_data, lead_id: "same-id", visitor_id: "ignored" },
      { custom_data: { ...custom_data, author_name: "Known lead" }, lead_id: "same-id" },
      { custom_data, visitor_id: "same-id" },
      { custom_data, visitor_id: "another-visitor" },
    ])).toEqual([
      { id: "lead:same-id", name: "Known lead", avatar: null, count: 2 },
      { id: "visitor:same-id", name: "Anonymous Visitor", avatar: null, count: 1 },
      { id: "visitor:another-visitor", name: "Anonymous Visitor", avatar: null, count: 1 },
    ])
  })

  it("never treats owned-account or post metadata as a commenter", () => {
    expect(aggregateTopCommenters([{
      custom_data: {
        username: "owned.account", account: { id: "owned-id", username: "owned.account" },
        source: "comment", outstand_post_id: "post-1", post_id: "post-1",
      },
    }])).toEqual([])
  })

  it("scopes handle fallbacks by network and keeps profiles distinct without using them as avatars", () => {
    expect(aggregateTopCommenters([
      { custom_data: { social_handle: "Ada", network: "instagram" } },
      { custom_data: { social_handle: "ada", network: "instagram" } },
      { custom_data: { social_handle: "Ada", network: "facebook" } },
      { custom_data: { profile_url: "https://example.com/one", network: "instagram" } },
      { custom_data: { profile_url: "https://example.com/two", network: "instagram" } },
    ])).toEqual([
      { id: "handle:instagram:ada", name: "Ada", avatar: null, count: 2 },
      { id: "handle:facebook:ada", name: "Ada", avatar: null, count: 1 },
      { id: "profile:instagram:https://example.com/one", name: "Anonymous Visitor", avatar: null, count: 1 },
      { id: "profile:instagram:https://example.com/two", name: "Anonymous Visitor", avatar: null, count: 1 },
    ])
  })

  it("ignores malformed objects and blank fields rather than rendering or grouping objects", () => {
    expect(aggregateTopCommenters([
      { custom_data: null }, { custom_data: [] }, { custom_data: "not metadata" },
      { custom_data: { author: {}, from: { id: {}, name: [] }, social_handle: "  ", author_id: false } },
      { custom_data: { author_name: {}, author: { name: " Ada " }, author_id: 0, avatar: {} } },
    ])).toEqual([{ id: "author:unknown:0", name: "Ada", avatar: null, count: 1 }])
  })

  it("returns only the five most frequent commenters", () => {
    const rows = Array.from({ length: 6 }, (_, index) => Array.from({ length: index + 1 }, () => ({
      custom_data: { author_id: String(index), author_name: `Reader ${index}` },
    }))).flat()
    expect(aggregateTopCommenters(rows).map(({ count }) => count)).toEqual([6, 5, 4, 3, 2])
  })

  it("does not count the same synchronized message more than once", () => {
    const comment = { id: "message-1", custom_data: { author_id: "ada", author_name: "Ada", network: "instagram" } }
    expect(aggregateTopCommenters([comment, comment, { ...comment, id: "message-2" }]))
      .toEqual([{ id: "author:instagram:ada", name: "Ada", avatar: null, count: 2 }])
  })

  it("deduplicates provider replays without merging comment IDs across networks or posts", () => {
    const metadata = { author_id: "ada", author_name: "Ada", platform_comment_id: "comment-1", outstand_post_id: "post-1", network: "instagram" }
    const rows = [
      { id: "row-1", custom_data: metadata }, { id: "row-2", custom_data: metadata },
      { id: "row-3", custom_data: { ...metadata, outstand_post_id: "post-2" } },
      { id: "row-4", custom_data: { ...metadata, network: "facebook" } },
    ]
    expect(aggregateTopCommenters(rows).map(row => [row.id, row.count])).toEqual([
      ["author:instagram:ada", 2], ["author:facebook:ada", 1],
    ])
  })

  it.each(["javascript:alert(1)", "data:image/svg+xml,test", "https://user:secret@example.com/image.png", "/private/avatar"])(
    "does not expose an unsafe synchronized avatar %s", avatar => {
      expect(aggregateTopCommenters([{ custom_data: { author_id: "ada", author_name: "Ada", avatar } }])[0].avatar).toBeNull()
    },
  )
})