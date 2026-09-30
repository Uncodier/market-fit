import type { IcpMiningList } from "@/app/components/settings/icp-mining-lists"

export const listId = (index: number) => `${index.toString(16).padStart(8, "0")}-abcd-4000-8000-000000000000`
export const miningList = (index: number, overrides: Partial<IcpMiningList> = {}): IcpMiningList => ({
  id: listId(index), name: `Mining list ${index}`, status: "pending",
  total_targets: 100, processed_targets: 25, progress_percent: "25.00", ...overrides,
})
export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}