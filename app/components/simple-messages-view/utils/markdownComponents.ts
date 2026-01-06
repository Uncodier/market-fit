import React from 'react'

/**
 * Shared markdown components for rendering markdown in SimpleMessagesView
 * Matches the styling patterns from content page editor.css
 */
export const markdownComponents = {
  // Headings with proper sizing and spacing
  h1: ({ node, ...props }: any) => (
    <h1 
      className="text-2xl font-bold mt-6 mb-3 first:mt-0" 
      {...props} 
    />
  ),
  h2: ({ node, ...props }: any) => (
    <h2 
      className="text-xl font-bold mt-5 mb-2.5 border-b border-border pb-1" 
      {...props} 
    />
  ),
  h3: ({ node, ...props }: any) => (
    <h3 
      className="text-lg font-bold mt-4 mb-2" 
      {...props} 
    />
  ),
  h4: ({ node, ...props }: any) => (
    <h4 
      className="text-base font-bold mt-3 mb-1.5" 
      {...props} 
    />
  ),
  h5: ({ node, ...props }: any) => (
    <h5 
      className="text-sm font-bold mt-3 mb-1.5" 
      {...props} 
    />
  ),
  h6: ({ node, ...props }: any) => (
    <h6 
      className="text-sm font-semibold mt-3 mb-1.5" 
      {...props} 
    />
  ),
  
  // Paragraphs with proper spacing
  p: ({ node, ...props }: any) => (
    <p 
      className="my-2 leading-relaxed" 
      {...props} 
    />
  ),
  
  // Lists with proper padding and spacing
  ul: ({ node, ...props }: any) => (
    <ul 
      className="my-2 pl-6 list-disc space-y-1" 
      {...props} 
    />
  ),
  ol: ({ node, ...props }: any) => (
    <ol 
      className="my-2 pl-6 list-decimal space-y-1" 
      {...props} 
    />
  ),
  li: ({ node, ...props }: any) => (
    <li 
      className="my-1 leading-relaxed" 
      {...props} 
    />
  ),
  
  // Blockquotes with border styling
  blockquote: ({ node, ...props }: any) => (
    <blockquote 
      className="my-2 pl-4 border-l-3 border-muted-foreground/30 text-muted-foreground italic" 
      style={{ borderLeftWidth: '3px' }}
      {...props} 
    />
  ),
  
  // Code blocks with proper styling
  pre: ({ node, ...props }: any) => (
    <pre 
      className="my-2 p-3 rounded-md bg-muted overflow-x-auto" 
      style={{ 
        whiteSpace: 'pre-wrap', 
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        maxWidth: '100%'
      }} 
      {...props} 
    />
  ),
  code: ({ node, inline, ...props }: any) => {
    if (inline) {
      return (
        <code 
          className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono" 
          {...props} 
        />
      )
    }
    return (
      <code 
        className="block p-0 bg-transparent" 
        {...props} 
      />
    )
  },
  
  // Links with proper color and hover
  a: ({ node, ...props }: any) => (
    <a 
      className="text-primary hover:underline" 
      target="_blank"
      rel="noopener noreferrer"
      {...props} 
    />
  ),
  
  // Images with responsive sizing
  img: ({ node, ...props }: any) => (
    <img 
      className="max-w-full h-auto my-2 rounded-md" 
      style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
      {...props} 
    />
  ),
  
  // Tables with horizontal scroll support
  table: ({ node, ...props }: any) => (
    <div className="overflow-x-auto my-2 w-full">
      <table 
        className="min-w-full border-collapse border border-border" 
        {...props} 
      />
    </div>
  ),
  thead: ({ node, ...props }: any) => (
    <thead 
      className="bg-muted" 
      {...props} 
    />
  ),
  tbody: ({ node, ...props }: any) => (
    <tbody 
      {...props} 
    />
  ),
  tr: ({ node, ...props }: any) => (
    <tr 
      className="border-b border-border" 
      {...props} 
    />
  ),
  th: ({ node, ...props }: any) => (
    <th 
      className="px-4 py-2 text-left font-semibold border border-border" 
      {...props} 
    />
  ),
  td: ({ node, ...props }: any) => (
    <td 
      className="px-4 py-2 border border-border" 
      {...props} 
    />
  ),
  
  // Strong and emphasis
  strong: ({ node, ...props }: any) => (
    <strong 
      className="font-bold" 
      {...props} 
    />
  ),
  em: ({ node, ...props }: any) => (
    <em 
      className="italic" 
      {...props} 
    />
  ),
  
  // Horizontal rule
  hr: ({ node, ...props }: any) => (
    <hr 
      className="my-4 border-t border-border" 
      {...props} 
    />
  ),
}

