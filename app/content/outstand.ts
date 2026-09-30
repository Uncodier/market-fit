"use server"

import { authorizeOutstandSite, resolveOutstandAccounts } from "./outstand-access"
import { outstandFailure, parseOutstandPublish, UNCONFIRMED_PUBLISH, type OutstandPublishInput } from "./outstand-contract"
import { requestOutstandPosts } from "./outstand-http"
import { parseOutstandPosts, parseOutstandPublished } from "./outstand-response"

export async function fetchOutstandPosts(siteId: string) {
  try {
    const access = await authorizeOutstandSite(siteId, "select")
    const result = await requestOutstandPosts(access.siteId, access.token, "GET")
    return { data: parseOutstandPosts(result, access.siteId) }
  } catch (error) {
    // Access failures must remain visible, never disguised as an empty post list.
    return outstandFailure(error, "Unable to load social posts.")
  }
}

export async function publishOutstandPost(siteId: string, payload: OutstandPublishInput): Promise<
  { success: true; data: ReturnType<typeof parseOutstandPublished>; error?: never } |
  ReturnType<typeof outstandFailure>
> {
  try {
    const access = await authorizeOutstandSite(siteId, "insert")
    const input = parseOutstandPublish(access.siteId, payload)
    const accounts = await resolveOutstandAccounts(access, input.accounts)
    const result = await requestOutstandPosts(access.siteId, access.token, "POST", {
      ...input, tenant_id: access.siteId, accounts,
    })
    return { success: true as const, data: parseOutstandPublished(result, access.siteId) }
  } catch (error) {
    // Never replay a publish: a timeout or lost response can follow a real post.
    return outstandFailure(error, UNCONFIRMED_PUBLISH)
  }
}
