/**
 * Chrome Translate, password managers, and similar extensions rewrite text
 * nodes in the live DOM. React 19 then throws:
 *   Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.
 * Installing this before React commits makes those mismatches a no-op instead
 * of crashing the shop / checkout tree.
 */

export const DOM_RECONCILE_GUARD_FLAG = "__mfDomReconcileGuard"

export const DOM_RECONCILE_GUARD_INLINE_SCRIPT = `(function(){try{if(typeof Node!=="function"||!Node.prototype||window.${DOM_RECONCILE_GUARD_FLAG})return;window.${DOM_RECONCILE_GUARD_FLAG}=1;var p=Node.prototype,rm=p.removeChild,ins=p.insertBefore;p.removeChild=function(c){if(c&&c.parentNode!==this)return c.parentNode?rm.call(c.parentNode,c):c;return rm.call(this,c)};p.insertBefore=function(n,r){if(r&&r.parentNode!==this)return ins.call(this,n,null);return ins.call(this,n,r)}}catch(e){}})();`

type GuardedGlobal = typeof globalThis & {
  [DOM_RECONCILE_GUARD_FLAG]?: boolean
}

export function installDomReconcileGuard(
  target: Pick<typeof globalThis, "Node"> = globalThis
): boolean {
  const nodeCtor = target.Node
  if (typeof nodeCtor !== "function" || !nodeCtor.prototype) return false

  const flagged = target as GuardedGlobal
  if (flagged[DOM_RECONCILE_GUARD_FLAG]) return false
  flagged[DOM_RECONCILE_GUARD_FLAG] = true

  const proto = nodeCtor.prototype
  const originalRemoveChild = proto.removeChild
  const originalInsertBefore = proto.insertBefore

  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child && child.parentNode !== this) {
      return child.parentNode
        ? originalRemoveChild.call(child.parentNode, child)
        : child
    }
    return originalRemoveChild.call(this, child)
  }

  proto.insertBefore = function <T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return originalInsertBefore.call(this, newNode, null)
    }
    return originalInsertBefore.call(this, newNode, referenceNode)
  }

  return true
}
