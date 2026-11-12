"use client"

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function isPreviewableMarkdown(path: string): boolean {
  return /\.(md|markdown)$/i.test(path)
}

export function ArchiveMarkdownPreview({ content, name, isDarkMode }: {
  content: string
  name: string
  isDarkMode: boolean
}) {
  return (
    <section aria-label={`Preview: ${name}`} className="h-full overflow-auto bg-background p-6 sm:p-8">
      <div className={`prose prose-sm mx-auto max-w-4xl break-words ${isDarkMode ? 'prose-invert' : ''}
        [&_pre]:overflow-x-auto [&_table]:block [&_table]:overflow-x-auto`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
          a: ({ children, href }) => href
            ? <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{children}</a>
            : <span>{children}</span>,
          // Archive images are not resolved; avoid automatic external requests.
          img: ({ alt }) => <span className="text-muted-foreground">{alt || 'Image'}</span>,
        }}>
          {content}
        </ReactMarkdown>
      </div>
    </section>
  )
}