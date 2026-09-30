/** The archive viewer only consumes tar-stream's entry extraction API. */
declare module "tar-stream" {
  import type { Readable, Writable } from "node:stream"

  interface Header {
    name: string
    type?: string
    size?: number
  }

  interface EntryStream extends Readable {
    on(event: "data", listener: (chunk: Uint8Array) => void): this
    on(event: "end", listener: () => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  interface Extract extends Writable {
    on(event: "entry", listener: (header: Header, stream: EntryStream, next: () => void) => void): this
    on(event: "finish", listener: () => void): this
    on(event: "error", listener: (error: Error) => void): this
    on(event: string, listener: (...args: unknown[]) => void): this
  }

  export function extract(): Extract
}