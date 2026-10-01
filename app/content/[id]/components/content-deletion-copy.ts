import type { ContentDeletionPreview, DeletionDisposition } from "../../content-deletion-preview"

export function contentDeletionCopy(preview: ContentDeletionPreview | null) {
  const names = (dispositions: DeletionDisposition[]) => {
    const labels = Array.from(new Set(preview?.accounts.filter(account => dispositions.includes(account.disposition))
      .map(account => account.label) ?? []))
    return new Intl.ListFormat("en", { type: "conjunction" }).format(labels)
  }
  const published = names(["remote", "manual"])
  const scheduled = names(["scheduled"])
  const remote = names(["remote"])
  const unknown = !preview || preview.accounts.some(account => account.disposition === "unknown")
  return {
    option: remote ? "Also delete linked publications and Outstand records"
      : scheduled ? "Also cancel scheduled posts and remove Outstand records" : "Also remove linked Outstand records",
    confirm: remote ? "Delete content and linked posts"
      : scheduled ? "Delete content and cancel posts" : "Delete content and Outstand records",
    localHelp: [
      "Only the local content will be deleted. Outstand records will remain and may still appear in the content list.",
      published && `Published posts on ${published} will stay online.`,
      scheduled && `Scheduled posts on ${scheduled} will still be published unless cancelled in Outstand.`,
      unknown && "Any linked publications or schedules will remain unchanged.",
    ].filter(Boolean).join(" "),
  }
}