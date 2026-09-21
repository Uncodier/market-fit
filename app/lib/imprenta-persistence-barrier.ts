type SaveResult = { error?: unknown } | unknown

export class ImprentaPersistenceBarrier {
  private readonly pending = new Map<string, Set<Promise<SaveResult>>>()
  private readonly failures = new Map<string, Map<string, unknown>>()

  track<T extends SaveResult>(
    nodeId: string,
    operation: PromiseLike<T>,
    category = "node",
  ): Promise<T> {
    const tracked = Promise.resolve(operation).then(
      (result) => {
        const error =
          result && typeof result === "object" && "error" in result
            ? result.error
            : undefined
        const failures = this.failures.get(nodeId) ?? new Map()
        if (error) {
          failures.set(category, error)
          this.failures.set(nodeId, failures)
        } else {
          failures.delete(category)
          if (failures.size === 0) this.failures.delete(nodeId)
        }
        return result
      },
      (error) => {
        const failures = this.failures.get(nodeId) ?? new Map()
        failures.set(category, error)
        this.failures.set(nodeId, failures)
        throw error
      },
    )

    const operations = this.pending.get(nodeId) ?? new Set()
    operations.add(tracked)
    this.pending.set(nodeId, operations)
    void tracked.finally(() => {
      operations.delete(tracked)
      if (operations.size === 0) this.pending.delete(nodeId)
    }).catch(() => undefined)

    return tracked
  }

  async wait(nodeId: string): Promise<void> {
    while (this.pending.get(nodeId)?.size) {
      await Promise.allSettled(Array.from(this.pending.get(nodeId) ?? []))
    }

    const error = this.failures.get(nodeId)?.values().next().value
    if (error) {
      throw error instanceof Error
        ? error
        : new Error("The latest node changes could not be saved")
    }
  }
}
