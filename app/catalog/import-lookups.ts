/** Unlike JSON escapes, PostgREST only needs quotes/backslashes escaped inside
 * a double-quoted operand. Keep every value quoted, including literal quotes. */
export function catalogImportInFilter(values: string[]): string {
  return `(${values.map(value => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`).join(",")})`
}

/** Bound PostgREST IN operands by encoded URL size as well as row count. */
export function catalogImportLookupChunks(values: string[]): string[][] {
  const chunks: string[][] = []
  let chunk: string[] = []
  let bytes = 0
  for (const value of [...new Set(values)]) {
    const size = encodeURIComponent(catalogImportInFilter([value])).length + 3
    if (chunk.length && (chunk.length >= 50 || bytes + size > 3500)) {
      chunks.push(chunk)
      chunk = []
      bytes = 0
    }
    chunk.push(value)
    bytes += size
  }
  if (chunk.length) chunks.push(chunk)
  return chunks
}