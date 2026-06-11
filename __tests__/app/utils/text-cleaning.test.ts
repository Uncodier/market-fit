import { 
  cleanHtmlContent, 
  cleanNewsTitle, 
  isValidCleanedContent, 
  extractCleanText 
} from '../text-cleaning'

describe('Text Cleaning Utilities', () => {
  
  describe('cleanHtmlContent', () => {
    it('should remove HTML tags completely', () => {
      const input = '<p>This is a <strong>news</strong> article about <a href="http://example.com">technology</a>.</p>'
      const expected = 'This is a news article about technology.'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle real Google News RSS content with font tags', () => {
      const input = 'Apple Announces New iPhone Models <font color="#6f6f6f">Reuters</font>'
      const expected = 'Apple Announces New iPhone Models'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should clean HTML entities properly', () => {
      const input = 'Apple&apos;s new product &amp; services &ndash; &ldquo;revolutionary&rdquo; says CEO'
      const expected = "Apple's new product & services - \"revolutionary\" says CEO"
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should remove URLs from content', () => {
      const input = 'Read more at https://www.example.com/article or visit www.news.com for updates'
      const expected = 'Read more at or visit for updates'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle complex RSS feed description with multiple issues', () => {
      const input = `
        <a href="https://example.com">Tech Company Raises $50M</a> in Series B funding round.
        &nbsp;&nbsp;The startup, which focuses on AI development, announced the news today.
        <font color="#6f6f6f">- TechCrunch</font>
        Read more at https://techcrunch.com/article
      `
      const expected = 'Tech Company Raises $50M in Series B funding round. The startup, which focuses on AI development, announced the news today.'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle CDATA sections', () => {
      const input = '<![CDATA[Breaking: New AI breakthrough announced by researchers]]>'
      const expected = 'Breaking: New AI breakthrough announced by researchers'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should remove source attribution patterns', () => {
      const input = 'Major tech acquisition announced - Bloomberg'
      const expected = 'Major tech acquisition announced'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle numeric HTML entities', () => {
      const input = 'Price increased by 15&#37; this quarter &#8211; company reports'
      const expected = 'Price increased by 15% this quarter - company reports'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle hexadecimal HTML entities', () => {
      const input = 'New product launch&#x2014;featuring advanced technology'
      const expected = 'New product launch—featuring advanced technology'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should remove unwanted phrases', () => {
      const input = 'Important business news about mergers and acquisitions. Read more...'
      const expected = 'Important business news about mergers and acquisitions.'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle very long content and truncate appropriately', () => {
      const longInput = 'A'.repeat(600) + ' This should be truncated.'
      const result = cleanHtmlContent(longInput)
      expect(result.length).toBeLessThanOrEqual(503) // 500 + "..."
      expect(result.endsWith('...')).toBe(true)
    })

    it('should return empty string for invalid input', () => {
      expect(cleanHtmlContent('')).toBe('')
      expect(cleanHtmlContent(null as any)).toBe('')
      expect(cleanHtmlContent(undefined as any)).toBe('')
      expect(cleanHtmlContent(123 as any)).toBe('')
    })

    it('should handle content with only HTML entities', () => {
      const input = '&nbsp;&nbsp;&hellip;&nbsp;'
      const expected = ''
      expect(cleanHtmlContent(input)).toBe(expected)
    })
  })

  describe('cleanNewsTitle', () => {
    it('should clean news titles specifically', () => {
      const input = '[BREAKING] Tech Company IPO <font color="#666">- Reuters</font>'
      const expected = 'Tech Company IPO'
      expect(cleanNewsTitle(input)).toBe(expected)
    })

    it('should remove source suffixes from titles', () => {
      const input = 'Major Breakthrough in AI Research - CNN'
      const expected = 'Major Breakthrough in AI Research'
      expect(cleanNewsTitle(input)).toBe(expected)
    })

    it('should handle titles with HTML tags', () => {
      const input = '<b>URGENT:</b> Market Update &amp; Analysis <i>Today</i>'
      const expected = 'URGENT: Market Update & Analysis Today'
      expect(cleanNewsTitle(input)).toBe(expected)
    })
  })

  describe('isValidCleanedContent', () => {
    it('should validate good content', () => {
      const goodContent = 'This is a well-formed news article about technology and business developments.'
      expect(isValidCleanedContent(goodContent)).toBe(true)
    })

    it('should reject content that is too short', () => {
      expect(isValidCleanedContent('Short')).toBe(false)
      expect(isValidCleanedContent('')).toBe(false)
    })

    it('should reject content with too many special characters', () => {
      const badContent = '®™©§¶†‡•′″‹›‾⁄℘ℑℜℵ←↑→↓↔↵⇐⇑⇒⇓⇔'
      expect(isValidCleanedContent(badContent)).toBe(false)
    })

    it('should reject content without meaningful words', () => {
      const badContent = '123 456 789'
      expect(isValidCleanedContent(badContent)).toBe(false)
    })
  })

  describe('extractCleanText', () => {
    it('should handle mixed HTML and plain text', () => {
      const input = 'Some text with <b>HTML</b> and regular content'
      const expected = 'Some text with HTML and regular content'
      expect(extractCleanText(input)).toBe(expected)
    })

    it('should handle plain text without HTML', () => {
      const input = 'Just plain text with &amp; entities'
      const expected = 'Just plain text with & entities'
      expect(extractCleanText(input)).toBe(expected)
    })
  })

  describe('Real-world RSS examples', () => {
    it('should handle typical Google News RSS title', () => {
      const input = '<![CDATA[Startup Receives $25M in Funding Round <font color="#6f6f6f">TechCrunch</font>]]>'
      const expected = 'Startup Receives $25M in Funding Round'
      expect(cleanNewsTitle(input)).toBe(expected)
    })

    it('should handle typical Google News RSS description', () => {
      const input = `
        <a href="https://techcrunch.com/story">The funding round was led by prominent VCs</a>
        &nbsp;and will be used to expand the company's AI capabilities.
        <font color="#6f6f6f">TechCrunch</font>
        &hellip; <a href="https://techcrunch.com/story">Read more</a>
      `
      const expected = 'The funding round was led by prominent VCs and will be used to expand the company\'s AI capabilities.'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle BBC News style RSS content', () => {
      const input = 'Technology firms report strong quarterly results amid market uncertainty - BBC News'
      const expected = 'Technology firms report strong quarterly results amid market uncertainty'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle Reuters style RSS content', () => {
      const input = 'EXCLUSIVE-Major merger talks between tech giants continue, sources say via Reuters'
      const expected = 'EXCLUSIVE-Major merger talks between tech giants continue, sources say'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle content with embedded links and source attribution', () => {
      const input = `
        <p><a href="https://example.com">Company X announces new product line</a> 
        featuring innovative technology solutions. The announcement comes as the industry 
        faces increasing competition.</p>
        <p>Source: Industry Weekly | More details at https://industry.com/news</p>
      `
      const expected = 'Company X announces new product line featuring innovative technology solutions. The announcement comes as the industry faces increasing competition.'
      expect(cleanHtmlContent(input)).toBe(expected)
    })
  })

  describe('Edge cases', () => {
    it('should handle malformed HTML gracefully', () => {
      const input = '<p>Unclosed paragraph <b>with bold text <i>and italic'
      const expected = 'Unclosed paragraph with bold text and italic'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle content with only whitespace and HTML', () => {
      const input = '<p>&nbsp;</p><div>   </div><span>\t\n</span>'
      const expected = ''
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle content with script and style tags', () => {
      const input = `
        Important news content here.
        <script>alert('malicious code')</script>
        <style>body { display: none; }</style>
        More news content.
      `
      const expected = 'Important news content here. More news content.'
      expect(cleanHtmlContent(input)).toBe(expected)
    })

    it('should handle mixed quote styles', () => {
      const input = 'CEO says "innovation" and \'growth\' are key priorities'
      const expected = 'CEO says "innovation" and "growth" are key priorities'
      expect(cleanHtmlContent(input)).toBe(expected)
    })
  })
}) 