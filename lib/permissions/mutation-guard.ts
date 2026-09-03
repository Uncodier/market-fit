import { canCommand } from "./capabilities"
import { isRlsError, mapPermissionError } from "./error-map"
import type { PermissionCommand } from "./types"

type GuardOptions = {
  onDenied?: (command: PermissionCommand) => void
}

const WRITE_METHODS: Record<string, PermissionCommand> = {
  insert: "insert",
  upsert: "insert",
  update: "update",
  delete: "delete",
}

function deniedResult(command: PermissionCommand) {
  return {
    data: null,
    error: {
      code: "42501",
      message: mapPermissionError({ code: "42501", message: "permission denied" }, command).message,
      details: null,
      hint: null,
    },
    count: null,
    status: 403,
    statusText: "Forbidden",
  }
}

function deniedBuilder(command: PermissionCommand, options: GuardOptions) {
  options.onDenied?.(command)
  const result = deniedResult(command)
  const builder: Record<string, unknown> = {}
  const passthrough = () => proxy
  const proxy = new Proxy(builder, {
    get(_target, prop) {
      if (prop === "then") {
        return (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
          Promise.resolve(result).then(onFulfilled, onRejected)
      }
      if (prop === "catch") {
        return (onRejected?: (reason: unknown) => unknown) => Promise.resolve(result).catch(onRejected)
      }
      if (typeof prop === "string") return passthrough
      return undefined
    },
  })
  return proxy
}

function mapWriteResult(res: unknown, options: GuardOptions, command: PermissionCommand = "update") {
  if (!res || typeof res !== "object") return res
  const record = res as { error?: unknown }
  if (!isRlsError(record.error)) return res
  options.onDenied?.(command)
  return {
    ...record,
    error: mapPermissionError(record.error as { message?: string; code?: string }, command),
  }
}

function wrapBuilder(
  builder: unknown,
  options: GuardOptions,
  writeCommand: PermissionCommand = "update"
): unknown {
  if (!builder || typeof builder !== "object") return builder

  return new Proxy(builder as object, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && prop in WRITE_METHODS) {
        const command = WRITE_METHODS[prop]
        return (...args: unknown[]) => {
          if (!canCommand(command)) {
            return deniedBuilder(command, options)
          }
          const method = Reflect.get(target, prop, receiver)
          if (typeof method !== "function") return method
          return wrapBuilder(method.apply(target, args), options, command)
        }
      }

      if (prop === "then") {
        const thenFn = Reflect.get(target, prop, receiver)
        if (typeof thenFn !== "function") return thenFn
        return (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
          thenFn.call(target, (res: unknown) => {
            const mapped = mapWriteResult(res, options, writeCommand)
            return onFulfilled ? onFulfilled(mapped) : mapped
          }, onRejected)
      }

      const value = Reflect.get(target, prop, receiver)
      if (typeof value === "function") {
        return (...args: unknown[]) => {
          const result = value.apply(target, args)
          if (result && typeof result === "object") {
            return wrapBuilder(result, options, writeCommand)
          }
          return result
        }
      }
      return value
    },
  })
}

function wrapWriteMethods(builder: unknown, options: GuardOptions): unknown {
  if (!builder || typeof builder !== "object") return builder

  return new Proxy(builder as object, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && prop in WRITE_METHODS) {
        const command = WRITE_METHODS[prop]
        return (...args: unknown[]) => {
          if (!canCommand(command)) {
            return deniedBuilder(command, options)
          }
          const method = Reflect.get(target, prop, receiver)
          if (typeof method !== "function") return method
          return wrapBuilder(method.apply(target, args), options, command)
        }
      }

      const value = Reflect.get(target, prop, receiver)
      if (typeof value === "function") {
        return value.bind(target)
      }
      return value
    },
  })
}

const UNGUARDED_TABLES = new Set(["site_members", "instance_artifacts"])

export function wrapSupabaseClient<T extends { from: any; rpc?: any }>(
  client: T,
  options: GuardOptions = {}
): T {
  const originalFrom = client.from.bind(client)
  client.from = ((table: string, ...args: unknown[]) => {
    const builder = originalFrom(table, ...args)
    if (UNGUARDED_TABLES.has(table)) return builder
    return wrapWriteMethods(builder, options)
  }) as T["from"]

  return client
}
