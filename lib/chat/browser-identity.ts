"use client"

import { getIdentitySdk, SUPPORT_SITE_ID, type IdentitySdk } from "./identity-types"

const RENEW_AFTER_MS = 10 * 60_000
const ATTEMPTS = 10

function wait(signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve()
    const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve() }
    const timer = setTimeout(done, 1000)
    signal.addEventListener("abort", done, { once: true })
  })
}

/** Keeps bearer credentials in flight only; account/session transitions invalidate work. */
export class ChatIdentityCoordinator {
  private userId: string | null | undefined
  private generation = 0
  private controller?: AbortController
  private operation?: Promise<void>
  private resetRequired = true
  private logout?: Promise<void>
  private identified?: { userId: string; sessionId: string; renewAt: number }

  constructor(private readonly sdk = getIdentitySdk) {}

  sync(userId: string | null): Promise<void> {
    if (userId !== this.userId) {
      this.controller?.abort()
      this.generation += 1
      this.operation = undefined
      this.userId = userId
      this.identified = undefined
      this.resetRequired = true
      // SDK logout clears local protected state synchronously, before network I/O.
      const sdk = this.sdk()
      if (sdk) this.beginLogout(sdk)
    }
    if (this.operation) return this.operation
    this.controller = new AbortController()
    const generation = this.generation
    const work = this.run(userId, generation, this.controller.signal).catch(() => {
      // Optional support chat must never block auth or fall back to email OTP.
    }).finally(() => {
      if (this.generation === generation) this.operation = undefined
    })
    this.operation = work
    return work
  }

  cancel(): void {
    this.controller?.abort()
    this.generation += 1
    this.operation = undefined
    this.userId = undefined
  }

  async clearForSignOut(): Promise<void> {
    // Keep revocation in flight and preserve its barrier, but never hold app
    // sign-out hostage to an unavailable support backend.
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        this.sync(null),
        new Promise<void>((resolve) => { timer = setTimeout(resolve, 3000) }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  private beginLogout(sdk: IdentitySdk): void {
    const previous = this.logout
    let current: Promise<void>
    try { current = sdk.logoutIdentity() } catch { current = Promise.reject(new Error("Chat revocation unavailable")) }
    // Do not issue a new identity until every outstanding revocation completes.
    const operation = Promise.all([previous?.catch(() => undefined), current]).then(() => undefined)
    this.logout = operation
    this.resetRequired = false
    void operation.catch(() => {
      if (this.logout === operation) this.resetRequired = true
    })
  }

  private async run(userId: string | null, generation: number, signal: AbortSignal): Promise<void> {
    const isCurrent = () => !signal.aborted && this.generation === generation
    for (let attempt = 0; attempt < ATTEMPTS && isCurrent(); attempt += 1) {
      const sdk = this.sdk()
      if (!sdk && !userId) return
      if (!sdk) { await wait(signal); continue }
      try {
        if (this.resetRequired) this.beginLogout(sdk)
        await this.logout
        if (!isCurrent() || !userId) return
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return
        const context = await sdk.getIdentityContext()
        if (!isCurrent() || context.siteId !== SUPPORT_SITE_ID || !context.sessionToken) return
        if (this.identified?.userId === userId && this.identified.sessionId === context.sessionId && Date.now() < this.identified.renewAt) return

        const response = await fetch("/api/chat/identity-token", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { "Content-Type": "application/json", "x-visitor-session-token": context.sessionToken },
          body: JSON.stringify({ session_id: context.sessionId }),
          signal,
        })
        if (!isCurrent()) return
        if (!response.ok) {
          if ([401, 403].includes(response.status)) {
            this.identified = undefined
            this.beginLogout(sdk)
            await this.logout
            return
          }
          if ([400, 429, 503].includes(response.status)) return
          throw new Error("Identity unavailable")
        }
        const payload = await response.json()
        if (!isCurrent()) return
        if (!payload?.success || payload.data?.user_id !== userId || typeof payload.data?.identity_token !== "string") return
        const latest = await sdk.getIdentityContext()
        if (!isCurrent() || latest.sessionId !== context.sessionId || latest.siteId !== context.siteId) return
        const result = await sdk.identify({ identityToken: payload.data.identity_token })
        if (!isCurrent()) return
        if (result.status === "verified") {
          const renewAt = Math.min(Date.now() + RENEW_AFTER_MS, result.expiresAt ? result.expiresAt - 60_000 : Infinity)
          this.identified = { userId, sessionId: context.sessionId, renewAt }
        }
        return
      } catch {
        if (isCurrent() && attempt + 1 < ATTEMPTS) await wait(signal)
      }
    }
  }
}