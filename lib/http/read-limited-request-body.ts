export class RequestBodyTooLargeError extends Error {
  readonly status = 413

  constructor(readonly maxBytes: number) {
    super(`Request body exceeds the ${maxBytes} byte limit`)
    this.name = "RequestBodyTooLargeError"
  }
}

export async function readLimitedRequestBody(
  request: Request,
  maxBytes: number
): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes)
  }

  if (!request.body) return new Uint8Array()

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      throw new RequestBodyTooLargeError(maxBytes)
    }
    chunks.push(value)
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

export function decodeRequestBody(body: Uint8Array): string {
  return new TextDecoder().decode(body)
}
