export function getMentionQuery(text: string, cursorPosition: number): { query: string, start: number, end: number } | null {
  if (cursorPosition < 0 || cursorPosition > text.length) return null

  // Find the text before the cursor
  const textBeforeCursor = text.slice(0, cursorPosition)
  
  // Look for an '@' that starts a word (preceded by space or start of string)
  const lastAtPos = textBeforeCursor.lastIndexOf('@')
  if (lastAtPos === -1) return null
  
  if (lastAtPos > 0 && textBeforeCursor[lastAtPos - 1] !== ' ' && textBeforeCursor[lastAtPos - 1] !== '\n') {
    return null
  }
  
  // The query is everything after the '@' up to the cursor
  const query = textBeforeCursor.slice(lastAtPos + 1)
  
  // If there's a space or newline in the query, it means the mention is closed
  if (query.includes(' ') || query.includes('\n')) return null

  // Check where the current word ends (to replace it completely if selected)
  const textAfterCursor = text.slice(cursorPosition)
  const matchEnd = textAfterCursor.match(/^([^\s\n]*)/)
  const endOffset = matchEnd ? matchEnd[1].length : 0

  return {
    query,
    start: lastAtPos,
    end: cursorPosition + endOffset
  }
}
