import { extractUrlsFromText, generateTitleFromUrl } from '../url-cleaning'

describe('URL Cleaning Utilities', () => {
  
  describe('extractUrlsFromText', () => {
    it('should preserve query parameters in URLs', () => {
      const text = 'Check out this link: https://www.calendly.com/sergio-prado?param=value&another=test'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://www.calendly.com/sergio-prado?param=value&another=test')
    })

    it('should preserve paths in URLs', () => {
      const text = 'Visit https://example.com/path/to/resource for more info'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://example.com/path/to/resource')
    })

    it('should preserve fragments in URLs', () => {
      const text = 'See https://docs.example.com/guide#section-1 for details'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://docs.example.com/guide#section-1')
    })

    it('should preserve complex URLs with paths, queries, and fragments', () => {
      const text = 'The full URL is https://app.example.com/dashboard/settings?tab=profile&view=edit#personal-info'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://app.example.com/dashboard/settings?tab=profile&view=edit#personal-info')
    })

    it('should remove trailing sentence punctuation but preserve URL punctuation', () => {
      const text = 'Check this out: https://example.com/api?key=123&format=json.'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://example.com/api?key=123&format=json')
    })

    it('should handle URLs with equals signs in query values', () => {
      const text = 'OAuth callback: https://app.com/auth/callback?code=abc123&state=xyz=789'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://app.com/auth/callback?code=abc123&state=xyz=789')
    })

    it('should handle URLs with ampersands in query parameters', () => {
      const text = 'Search results: https://search.com/results?q=test&sort=date&filter=all'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://search.com/results?q=test&sort=date&filter=all')
    })

    it('should handle URLs without protocol and add https', () => {
      const text = 'Visit www.calendly.com/sergio-prado?param=value'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://www.calendly.com/sergio-prado?param=value')
    })

    it('should handle multiple URLs in the same text', () => {
      const text = 'Visit https://example.com/page1?id=1 and also check www.test.com/page2#section'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(2)
      expect(result).toContain('https://example.com/page1?id=1')
      expect(result).toContain('https://www.test.com/page2#section')
    })

    it('should remove trailing closing brackets and parentheses', () => {
      const text = 'Link in parentheses (https://example.com/test?param=value) and brackets [https://test.com/page]'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(2)
      expect(result).toContain('https://example.com/test?param=value')
      expect(result).toContain('https://test.com/page')
    })

    it('should handle URLs with special characters in paths', () => {
      const text = 'API endpoint: https://api.example.com/v1/users/123/profile?include=settings&format=json'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://api.example.com/v1/users/123/profile?include=settings&format=json')
    })

    it('should return empty array for text without URLs', () => {
      const text = 'This is just regular text without any URLs'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(0)
    })

    it('should handle empty or null input', () => {
      expect(extractUrlsFromText('')).toEqual([])
      expect(extractUrlsFromText(null as any)).toEqual([])
      expect(extractUrlsFromText(undefined as any)).toEqual([])
    })
  })

  describe('generateTitleFromUrl', () => {
    it('should generate title with domain and path', () => {
      const url = 'https://example.com/user-profile'
      const result = generateTitleFromUrl(url)
      
      expect(result).toBe('Example, User Profile')
    })

    it('should handle URLs with query parameters', () => {
      const url = 'https://calendly.com/sergio-prado?param=value'
      const result = generateTitleFromUrl(url)
      
      expect(result).toBe('Calendly, Sergio Prado')
    })

    it('should handle Calendly URLs specifically', () => {
      const url = 'https://www.calendly.com/sergio-prado'
      const result = generateTitleFromUrl(url)
      
      expect(result).toBe('Calendly, Sergio Prado')
    })

    it('should handle complex paths', () => {
      const url = 'https://docs.google.com/document/edit'
      const result = generateTitleFromUrl(url)
      
      expect(result).toBe('Docs, Edit')
    })

    it('should fallback to hostname for root URLs', () => {
      const url = 'https://example.com'
      const result = generateTitleFromUrl(url)
      
      expect(result).toBe('Example')
    })

    it('should handle URLs with multiple path segments', () => {
      const url = 'https://github.com/user/repository/issues'
      const result = generateTitleFromUrl(url)
      
      expect(result).toBe('Github, Issues')
    })

    it('should handle invalid URLs gracefully', () => {
      const result = generateTitleFromUrl('not-a-url')
      
      expect(result).toBe('Visit Link')
    })
  })

  describe('Real-world URL examples', () => {
    it('should handle Calendly URLs correctly', () => {
      const text = 'Book a meeting: https://www.calendly.com/sergio-prado'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://www.calendly.com/sergio-prado')
    })

    it('should handle complex booking URLs with parameters', () => {
      const text = 'Schedule here: https://calendly.com/user/30min?month=2024-01&date=2024-01-15'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://calendly.com/user/30min?month=2024-01&date=2024-01-15')
    })

    it('should handle URLs mentioned in conversation context', () => {
      const text = 'Hola Jorge, gusto en conocerte, me encantaría ver que estas creando y como te podemos ayudar a vender, sácame una cita acá: https://www.calendly.com/sergio-prado'
      const result = extractUrlsFromText(text)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('https://www.calendly.com/sergio-prado')
    })
  })
})

