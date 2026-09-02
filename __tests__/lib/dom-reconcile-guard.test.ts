/**
 * @jest-environment jsdom
 */

import {
  DOM_RECONCILE_GUARD_FLAG,
  installDomReconcileGuard,
} from "../../lib/dom-reconcile-guard"

const originalRemoveChild = Node.prototype.removeChild
const originalInsertBefore = Node.prototype.insertBefore

describe("installDomReconcileGuard", () => {
  afterEach(() => {
    Node.prototype.removeChild = originalRemoveChild
    Node.prototype.insertBefore = originalInsertBefore
    delete (globalThis as { [key: string]: unknown })[DOM_RECONCILE_GUARD_FLAG]
  })

  it("is a no-op when Node is unavailable", () => {
    expect(installDomReconcileGuard({} as typeof globalThis)).toBe(false)
  })

  it("installs once and then becomes idempotent", () => {
    expect(installDomReconcileGuard()).toBe(true)
    expect(installDomReconcileGuard()).toBe(false)
  })

  it("keeps normal removeChild and insertBefore working", () => {
    installDomReconcileGuard()

    const parent = document.createElement("div")
    const child = document.createElement("span")
    const sibling = document.createElement("em")
    parent.appendChild(child)
    parent.insertBefore(sibling, child)

    expect(parent.firstChild).toBe(sibling)
    expect(parent.removeChild(child)).toBe(child)
    expect(child.parentNode).toBeNull()
    expect(parent.contains(sibling)).toBe(true)
  })

  it("does not throw when React-style removeChild targets a detached node", () => {
    installDomReconcileGuard()

    const parent = document.createElement("div")
    const orphan = document.createElement("span")
    const wrapper = document.createElement("font")
    wrapper.appendChild(orphan)

    expect(() => parent.removeChild(orphan)).not.toThrow()
    expect(orphan.parentNode).toBeNull()
  })

  it("does not throw when insertBefore reference is not a child of the parent", () => {
    installDomReconcileGuard()

    const parent = document.createElement("div")
    const node = document.createElement("span")
    const foreign = document.createElement("em")

    expect(() => parent.insertBefore(node, foreign)).not.toThrow()
    expect(parent.contains(node)).toBe(true)
  })
})
