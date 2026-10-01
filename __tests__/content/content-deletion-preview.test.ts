/** @jest-environment node */

import {
  buildContentDeletionPreview,
  type DeletionAccountSnapshot,
  type DeletionDisposition,
  type DeletionPostSnapshot,
} from "@/app/content/content-deletion-preview"

const NOW = Date.parse("2026-10-01T12:00:00Z")
const PUBLISHED_AT = "2026-10-01T11:00:00Z"
const scheduledAt = (offset: number) => new Date(NOW + offset).toISOString()
const account = (changes: Partial<DeletionAccountSnapshot> = {}): DeletionAccountSnapshot => ({
  network: "x", username: "account-one", status: "published",
  platformPostId: "remote-one", publishedAt: PUBLISHED_AT, ...changes,
})
const unpublished = (
  status: "pending" | "failed" = "pending", changes: Partial<DeletionAccountSnapshot> = {},
) => account({ status, platformPostId: null, publishedAt: null, ...changes })
const post = (
  socialAccounts = [account()], changes: Partial<Omit<DeletionPostSnapshot, "socialAccounts">> = {},
): DeletionPostSnapshot => ({
  id: "post-one", publishedAt: null, scheduledAt: null, isDraft: false, ...changes, socialAccounts,
})

function expectDispositions(
  posts: DeletionPostSnapshot[], dispositions: DeletionDisposition[], canDeleteRemotely: boolean,
) {
  const preview = buildContentDeletionPreview(posts, NOW)
  expect(preview.linkedPostCount).toBe(posts.length)
  expect(preview.accounts.map(item => item.disposition)).toEqual(dispositions)
  expect(preview.canDeleteRemotely).toBe(canDeleteRemotely)
}

describe("buildContentDeletionPreview", () => {
  it("allows exactly the API-supported published networks with fixed labels", () => {
    const networks = [
      ["x", "X"], ["linkedin", "LinkedIn"], ["facebook", "Facebook"], ["threads", "Threads"],
      ["youtube", "YouTube"], ["pinterest", "Pinterest"], ["google_business", "Google Business"],
      ["vimeo", "Vimeo"], ["reddit", "Reddit"], ["bluesky", "Bluesky"],
    ]
    const posts = [post(networks.map(([network]) => account({ network })), { publishedAt: PUBLISHED_AT })]
    expect(buildContentDeletionPreview(posts, NOW)).toEqual({
      linkedPostCount: 1,
      accounts: networks.map(([network, label]) => ({
        network, label, username: "account-one", disposition: "remote",
      })),
      canDeleteRemotely: true,
    })
  })

  it.each([["instagram", "Instagram"], ["tiktok", "TikTok"]])(
    "requires manual deletion for published %s", (network, label) => {
      expect(buildContentDeletionPreview([post([account({ network })])], NOW)).toEqual({
        linkedPostCount: 1,
        accounts: [{ network, label, username: "account-one", disposition: "manual" }],
        canDeleteRemotely: false,
      })
    },
  )

  it.each(["instagram", "tiktok", "new-network"])("can cancel safely scheduled %s", network => {
    expectDispositions([
      post([unpublished("pending", { network })], { scheduledAt: scheduledAt(75_001) }),
    ], ["scheduled"], true)
  })

  it("retains per-account guidance for a mixed-network published post", () => {
    expectDispositions([post([
      account(), account({ network: "instagram" }), account({ network: "tiktok" }),
      account({ network: "new-network" }),
    ])], ["remote", "manual", "manual", "unknown"], false)
  })

  it("preserves separate accounts on a network and repeated accounts across posts", () => {
    expect(buildContentDeletionPreview([
      post([account(), account({ username: "account-two" })]),
      post([account()], { id: "post-two" }),
    ], NOW)).toEqual({
      linkedPostCount: 2,
      accounts: [
        { network: "x", label: "X", username: "account-one", disposition: "remote" },
        { network: "x", label: "X", username: "account-two", disposition: "remote" },
        { network: "x", label: "X", username: "account-one", disposition: "remote" },
      ],
      canDeleteRemotely: true,
    })
  })

  it("keeps account order and dispositions across linked posts with different lifecycles", () => {
    expectDispositions([
      post([account(), account({ network: "instagram" })]),
      post([unpublished("pending", { network: "tiktok" })], { id: "post-two", scheduledAt: scheduledAt(300_000) }),
      post([unpublished("failed")], { id: "post-three" }),
      post([account({ status: "deleted" })], { id: "post-four" }),
    ], ["remote", "manual", "scheduled", "unpublished", "deleted"], false)
  })

  it.each([null, scheduledAt(-1), scheduledAt(75_000), scheduledAt(300_000)])(
    "treats pending drafts as unpublished regardless of schedule %s", schedule => {
      expectDispositions([post([
        unpublished(), unpublished("pending", { network: "instagram" }), unpublished("pending", { network: "tiktok" }),
      ], { isDraft: true, scheduledAt: schedule })], ["unpublished", "unpublished", "unpublished"], true)
    },
  )

  it("does not let the aggregate draft flag override published accounts", () => {
    expectDispositions([post([
      account({ publishedAt: null }), account({ network: "instagram" }),
    ], { isDraft: true })], ["remote", "manual"], false)
  })

  it("treats safe failed accounts as unpublished without a draft or future schedule", () => {
    expectDispositions([post([
      unpublished("failed"), unpublished("failed", { network: "instagram" }), unpublished("failed", { network: "tiktok" }),
    ], { scheduledAt: scheduledAt(-1) })], ["unpublished", "unpublished", "unpublished"], true)
  })

  it("accepts explicit deleted status even without a platform ID or remote support", () => {
    expectDispositions([post([
      account({ status: "deleted", platformPostId: null }),
      account({ network: "instagram", status: "deleted" }),
      account({ network: "tiktok", status: "deleted" }),
      account({ network: "new-network", status: "deleted", publishedAt: null }),
    ], { publishedAt: PUBLISHED_AT })], ["deleted", "deleted", "deleted", "deleted"], true)
  })

  it("allows published, deleted and safe failed accounts together", () => {
    expectDispositions([post([
      account(), account({ network: "instagram", status: "deleted" }), unpublished("failed", { network: "tiktok" }),
    ], { publishedAt: PUBLISHED_AT })], ["remote", "deleted", "unpublished"], true)
  })

  it("allows safe failed accounts alongside future pending accounts", () => {
    expectDispositions([post([
      unpublished(), unpublished("failed", { network: "instagram" }),
    ], { scheduledAt: scheduledAt(75_001) })], ["scheduled", "unpublished"], true)
  })

  it.each([null, "", "invalid-date", scheduledAt(-1), scheduledAt(0), scheduledAt(74_999), scheduledAt(75_000)])(
    "marks the entire post unknown for immediate, invalid or due schedule %s", schedule => {
      expectDispositions([post([
        unpublished(), unpublished("failed", { network: "instagram" }),
      ], { scheduledAt: schedule })], ["unknown", "unknown"], false)
    },
  )

  it("uses Date.now by default and reevaluates the strict scheduling boundary", () => {
    const clock = jest.spyOn(Date, "now").mockReturnValue(NOW)
    try {
      const posts = [post([unpublished()], { scheduledAt: scheduledAt(75_001) })]
      expect(buildContentDeletionPreview(posts).accounts[0].disposition).toBe("scheduled")
      clock.mockReturnValue(NOW + 1)
      expect(buildContentDeletionPreview(posts)).toMatchObject({
        accounts: [{ disposition: "unknown" }], canDeleteRemotely: false,
      })
    } finally {
      clock.mockRestore()
    }
  })

  it.each(["pending", "failed"] as const)("requires explicit null publication fields for %s", status => {
    for (const changes of [
      { platformPostId: "remote-id" }, { platformPostId: "" }, { platformPostId: " " },
      { publishedAt: PUBLISHED_AT }, { publishedAt: "" },
    ]) {
      expectDispositions([post([
        unpublished(status, changes), unpublished("failed", { network: "instagram" }),
      ], { isDraft: true, scheduledAt: scheduledAt(300_000) })], ["unknown", "unknown"], false)
    }
    for (const field of ["platformPostId", "publishedAt"] as const) {
      const incomplete = { ...unpublished(status) } as Partial<DeletionAccountSnapshot>
      delete incomplete[field]
      expectDispositions([post([incomplete as DeletionAccountSnapshot], { isDraft: true })], ["unknown"], false)
    }
  })

  it.each(["published", "deleted"])("marks the affected post unknown for mixed %s and pending", status => {
    for (const isDraft of [false, true]) {
      expectDispositions([
        post([
          account({ status }), unpublished("pending", { network: "instagram" }),
          unpublished("failed", { network: "tiktok" }),
        ], { isDraft, scheduledAt: scheduledAt(300_000) }),
        post([account()], { id: "unaffected-post" }),
      ], ["unknown", "unknown", "unknown", "remote"], false)
    }
  })

  it.each([PUBLISHED_AT, ""])("rejects nonnull aggregate publication without published/deleted accounts: %s", publishedAt => {
    for (const isDraft of [false, true]) {
      expectDispositions([post([
        unpublished(), unpublished("failed", { network: "instagram" }),
      ], { publishedAt, isDraft, scheduledAt: scheduledAt(300_000) })], ["unknown", "unknown"], false)
      expectDispositions([post([unpublished("failed")], { publishedAt, isDraft })], ["unknown"], false)
    }
  })

  it.each(["x", "instagram", "tiktok", "new-network"])("requires a nonempty platform post ID for published %s", network => {
    for (const platformPostId of [null, "", " \t\n"]) {
      expectDispositions([post([account({ network, platformPostId })])], ["unknown"], false)
    }
  })

  it.each(["unknown", "processing", "publishing", "scheduled", "draft", "already_deleted", "Published", ""])(
    "never infers publication or deletion from unrecognized status %s", status => {
      expectDispositions([post([
        account({ status, platformPostId: null, publishedAt: null }),
      ], { isDraft: true, scheduledAt: scheduledAt(300_000) })], ["unknown"], false)
    },
  )

  it.each(["published", "deleted", "failed", "pending"])("rejects duplicate account identities for %s", status => {
    const duplicate = account({ status, platformPostId: null, publishedAt: null })
    if (status === "published") duplicate.platformPostId = "remote-id"
    expectDispositions([
      post([duplicate, { ...duplicate }, unpublished("failed", { network: "instagram" })], { isDraft: true }),
      post([account()], { id: "unaffected-post" }),
    ], ["unknown", "unknown", "unknown", "remote"], false)
  })

  it("canonicalizes duplicate aliases before checking identities", () => {
    expectDispositions([post([
      account({ network: "TWITTER" }), account({ network: "X" }),
    ])], ["unknown", "unknown"], false)
  })

  it("canonicalizes network casing and Twitter aliases without changing usernames", () => {
    expect(buildContentDeletionPreview([post([
      account({ network: "Twitter", username: "@MixedCase" }),
      account({ network: "X", username: "OtherAccount" }),
      account({ network: "LINKEDIN" }),
      account({ network: "INSTAGRAM" }),
    ])], NOW).accounts).toEqual([
      { network: "x", label: "X", username: "@MixedCase", disposition: "remote" },
      { network: "x", label: "X", username: "OtherAccount", disposition: "remote" },
      { network: "linkedin", label: "LinkedIn", username: "account-one", disposition: "remote" },
      { network: "instagram", label: "Instagram", username: "account-one", disposition: "manual" },
    ])
  })

  it.each(["new-network", "mastodon", "google", "google-business", " twitter ", "constructor", "__proto__", "<script>secret</script>"])(
    "uses only the fixed unknown label for unsupported network %s", network => {
      expect(buildContentDeletionPreview([post([account({ network })])], NOW)).toEqual({
        linkedPostCount: 1,
        accounts: [{ network, label: "Unknown network", username: "account-one", disposition: "unknown" }],
        canDeleteRemotely: false,
      })
    },
  )

  it("blocks an empty post list", () => {
    expect(buildContentDeletionPreview([], NOW)).toEqual({ linkedPostCount: 0, accounts: [], canDeleteRemotely: false })
  })

  it("blocks posts without accounts even alongside a valid post", () => {
    expect(buildContentDeletionPreview([post([])], NOW)).toEqual({ linkedPostCount: 1, accounts: [], canDeleteRemotely: false })
    expectDispositions([post([]), post([account()], { id: "post-two" })], ["remote"], false)
  })

  it("does not mutate or expose snapshot objects", () => {
    const posts = [post([account({ network: "TWITTER" })])]
    const original = JSON.parse(JSON.stringify(posts))
    posts.forEach(item => {
      item.socialAccounts.forEach(Object.freeze)
      Object.freeze(item.socialAccounts)
      Object.freeze(item)
    })
    Object.freeze(posts)
    const preview = buildContentDeletionPreview(posts, NOW)
    preview.accounts[0].username = "changed"
    expect(posts).toEqual(original)
    expect(buildContentDeletionPreview(posts, NOW).accounts[0].username).toBe("account-one")
  })
})
