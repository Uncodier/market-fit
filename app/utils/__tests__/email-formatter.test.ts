import { 
  isMimeMultipartMessage, 
  parseMimeMultipartMessage, 
  formatEmailForChat,
  isEmailLikeMessage,
  getEmailSummary
} from '../email-formatter'

describe('Email Formatter Utilities', () => {
  
  const sampleMimeEmail = `--Apple-Mail=_F4579245-0FDA-4EAE-9DE9-C77217F707ED
Content-Transfer-Encoding: quoted-printable
Content-Type: text/plain; charset=utf-8

Hola Richard, te paso un resumen de lo que hablamos:

- Hay que hacer un setup de la cuenta para ver que estrategias nos propone el sistema y como opmtizar el presupuesto (lo coordino con Goerge acá mi calendly www.calendly.com/sergio-prado)

- Trataremos de rescatar leads actuales, y revisar que puntos de contacto automatizar del pipeline actual.

- Prospectar en paralelo con un nuevo Pipeline de mejora automatica con Market Fit.

- A mediano plazo buscar la integracion del mercado américano.

- Revisar estrategias de SEO y generacion de contenidos para autoridad.

--Apple-Mail=_F4579245-0FDA-4EAE-9DE9-C77217F707ED
Content-Transfer-Encoding: quoted-printable
Content-Type: text/html; charset=utf-8

<html><head><meta http-equiv="content-type" content="text/html; charset=utf-8"></head><body style="overflow-wrap: break-word; -webkit-nbsp-mode: space; line-break: after-white-space;">Hola Richard, te paso un resumen de lo que hablamos:<div><br></div><div>- Hay que hacer un setup de la cuenta para ver que estrategias nos propone el sistema y como opmtizar el presupuesto (lo coordino con Goerge acá mi calendly <a href="http://www.calendly.com/sergio-prado">www.calendly.com/sergio-prado</a>)</div><div><br></div><div>- Trataremos de rescatar leads actuales, y revisar que puntos de contacto automatizar del pipeline actual.</div><div><br></div><div>- Prospectar en paralelo con un nuevo Pipeline de mejora automatica con Market Fit.</div><div><br></div><div>- A mediano plazo buscar la integracion del mercado américano.</div><div><br></div><div>- Revisar estrategias de SEO y generacion de contenidos para autoridad.</div></body></html>

--Apple-Mail=_F4579245-0FDA-4EAE-9DE9-C77217F707ED--`

  describe('isMimeMultipartMessage', () => {
    it('should detect MIME multipart messages', () => {
      expect(isMimeMultipartMessage(sampleMimeEmail)).toBe(true)
    })

    it('should not detect regular text as MIME multipart', () => {
      const regularText = 'This is just a regular message without MIME formatting.'
      expect(isMimeMultipartMessage(regularText)).toBe(false)
    })

    it('should handle empty or invalid input', () => {
      expect(isMimeMultipartMessage('')).toBe(false)
      expect(isMimeMultipartMessage(null as any)).toBe(false)
      expect(isMimeMultipartMessage(undefined as any)).toBe(false)
    })
  })

  describe('parseMimeMultipartMessage', () => {
    it('should parse MIME multipart email correctly', () => {
      const result = parseMimeMultipartMessage(sampleMimeEmail)
      
      expect(result.hasMultipart).toBe(true)
      expect(result.textPlain).toContain('Hola Richard')
      expect(result.textPlain).toContain('setup de la cuenta')
      expect(result.textHtml).toContain('<html>')
      expect(result.textHtml).toContain('Hola Richard')
      expect(result.cleanText).toContain('Hola Richard')
      expect(result.originalFormat).toBe('mime-multipart')
    })

    it('should handle non-MIME messages', () => {
      const regularText = 'Just a regular message'
      const result = parseMimeMultipartMessage(regularText)
      
      expect(result.hasMultipart).toBe(false)
      expect(result.textPlain).toBeUndefined()
      expect(result.textHtml).toBeUndefined()
      expect(result.cleanText).toBe(regularText)
    })
  })

  describe('formatEmailForChat', () => {
    it('should format MIME multipart email for clean display', () => {
      const result = formatEmailForChat(sampleMimeEmail, 'clean')
      
      expect(result).toContain('Hola Richard')
      expect(result).toContain('setup de la cuenta')
      expect(result).not.toContain('<html>')
      expect(result).not.toContain('Content-Type')
      expect(result).not.toContain('--Apple-Mail')
    })

    it('should format MIME multipart email preserving original format when requested', () => {
      const result = formatEmailForChat(sampleMimeEmail, 'original')
      
      expect(result).toContain('Hola Richard')
      expect(result).not.toContain('<html>') // Should be converted to markdown
      expect(result).not.toContain('Content-Type')
    })

    it('should handle regular text messages', () => {
      const regularText = 'This is a regular message with no special formatting.'
      const result = formatEmailForChat(regularText)
      
      expect(result).toBe(regularText)
    })
  })

  describe('isEmailLikeMessage', () => {
    it('should detect MIME multipart messages as email-like', () => {
      expect(isEmailLikeMessage(sampleMimeEmail)).toBe(true)
    })

    it('should detect messages with email headers as email-like', () => {
      const emailWithHeaders = `Subject: Test Email
From: sender@example.com
To: recipient@example.com
Content-Type: text/plain

This is an email message.`
      
      expect(isEmailLikeMessage(emailWithHeaders)).toBe(true)
    })

    it('should not detect regular messages as email-like', () => {
      const regularMessage = 'This is just a regular chat message.'
      expect(isEmailLikeMessage(regularMessage)).toBe(false)
    })
  })

  describe('getEmailSummary', () => {
    it('should create a summary of long email content', () => {
      const summary = getEmailSummary(sampleMimeEmail, 100)
      
      expect(summary.length).toBeLessThanOrEqual(103) // 100 + "..."
      expect(summary).toContain('Hola Richard')
    })

    it('should return full content for short emails', () => {
      const shortEmail = 'Short message here.'
      const summary = getEmailSummary(shortEmail, 100)
      
      expect(summary).toBe(shortEmail)
    })

    it('should cut at sentence boundaries when possible', () => {
      const emailText = 'This is the first sentence. This is the second sentence that goes on and on.'
      const summary = getEmailSummary(emailText, 30)
      
      expect(summary).toBe('This is the first sentence.')
    })
  })

  describe('Real-world email examples', () => {
    it('should handle typical Apple Mail format', () => {
      const result = formatEmailForChat(sampleMimeEmail, 'clean')
      
      // Should extract the plain text content completely
      expect(result).toContain('Hola Richard, te paso un resumen')
      expect(result).toContain('setup de la cuenta')
      expect(result).toContain('Pipeline de mejora automatica')
      expect(result).toContain('mercado américano')
      expect(result).toContain('estrategias de SEO')
      expect(result).toContain('www.calendly.com/sergio-prado') // Full URL preserved
      
      // Should not contain MIME headers or HTML tags
      expect(result).not.toContain('Content-Transfer-Encoding')
      expect(result).not.toContain('Apple-Mail=')
      expect(result).not.toContain('<html>')
      expect(result).not.toContain('<div>')
    })

    it('should preserve line structure in formatted output', () => {
      const result = formatEmailForChat(sampleMimeEmail, 'clean')
      
      // Should maintain the bullet point structure
      expect(result).toContain('- Hay que hacer')
      expect(result).toContain('- Trataremos de rescatar')
      expect(result).toContain('- Prospectar en paralelo')
      expect(result).toContain('- A mediano plazo')
      expect(result).toContain('- Revisar estrategias')
    })
  })
}) 