"use client"

import type { ContentDeletionPreview, DeletionDisposition } from "../../content-deletion-preview"

const descriptions: Record<DeletionDisposition, string> = {
  remote: "Published — remote deletion supported, subject to account permissions.",
  manual: "Published — manual deletion required in the social network's app.",
  scheduled: "Scheduled — can be cancelled before publication.",
  unpublished: "Not published — the Outstand record can be removed.",
  deleted: "Already deleted remotely — only the Outstand record remains.",
  unknown: "Status or deletion support could not be verified. Check this post in Outstand.",
}

export function ContentDeletionSummary({ preview }: { preview: ContentDeletionPreview }) {
  const groups = new Map<string, { label: string; disposition: DeletionDisposition; count: number }>()
  for (const account of preview.accounts) {
    const key = `${account.label}:${account.disposition}`
    const group = groups.get(key)
    if (group) group.count += 1
    else groups.set(key, { label: account.label, disposition: account.disposition, count: 1 })
  }
  const manual = preview.accounts.some(account => account.disposition === "manual")
  const uncertain = preview.accounts.some(account => account.disposition === "unknown")
  const otherTargets = preview.accounts.some(account => !["manual", "unknown"].includes(account.disposition))
  return (
    <div className="space-y-3 text-sm">
      <p className="font-medium">{preview.linkedPostCount} linked {preview.linkedPostCount === 1 ? "post" : "posts"}</p>
      <ul aria-label="Linked social post deletion options" className="max-h-48 space-y-3 overflow-y-auto rounded-md border p-3">
        {Array.from(groups, ([key, group]) => (
          <li key={key}>
            <span className="font-medium">{group.label}{group.count > 1 ? ` (${group.count} publications)` : ""}</span>
            <p className="text-muted-foreground">{group.disposition === "manual"
              ? `Published — delete directly in ${group.label}. Outstand cannot remove this publication.`
              : descriptions[group.disposition]}</p>
            {group.disposition === "remote" && group.label === "Threads" && (
              <p className="text-muted-foreground">Requires the threads_delete permission for the connected account.</p>
            )}
          </li>
        ))}
      </ul>
      {manual && (
        <p className="text-muted-foreground">
          {otherTargets
            ? "This content mixes posts with different deletion support. Combined deletion is unavailable; supported posts will not be deleted automatically."
            : "Combined deletion is unavailable because these published posts require manual deletion."}
          {" "}Delete the publications marked above directly in their apps. You can still delete only the local content below.
        </p>
      )}
      {uncertain && <p className="text-muted-foreground">Combined deletion is unavailable until every linked post can be verified. Local-only deletion remains available.</p>}
    </div>
  )
}