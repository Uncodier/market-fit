import { getMentionQuery } from "@/app/components/context/mention-query"

describe("getMentionQuery", () => {
  it("should extract query after @ at the beginning of string", () => {
    const text = "@acme"
    const result = getMentionQuery(text, 5)
    expect(result).toEqual({ query: "acme", start: 0, end: 5 })
  })

  it("should extract query after @ with preceding space", () => {
    const text = "Hello @acme"
    const result = getMentionQuery(text, 11)
    expect(result).toEqual({ query: "acme", start: 6, end: 11 })
  })

  it("should extract query after @ with preceding newline", () => {
    const text = "Hello\n@acme"
    const result = getMentionQuery(text, 11)
    expect(result).toEqual({ query: "acme", start: 6, end: 11 })
  })

  it("should return null if @ is inside a word without space", () => {
    const text = "hello@acme"
    const result = getMentionQuery(text, 10)
    expect(result).toBeNull()
  })

  it("should return null if there is a space after @", () => {
    const text = "Hello @ acme"
    const result = getMentionQuery(text, 12)
    expect(result).toBeNull()
  })

  it("should return null if cursor is before @", () => {
    const text = "Hello @acme"
    const result = getMentionQuery(text, 5)
    expect(result).toBeNull()
  })

  it("should extract correct end position if cursor is in middle of the mention", () => {
    const text = "Hello @acmecorp testing"
    const result = getMentionQuery(text, 10) // Cursor between 'acm' and 'ecorp'
    expect(result).toEqual({ query: "acm", start: 6, end: 15 }) // 'acmecorp' is the full word
  })
})
