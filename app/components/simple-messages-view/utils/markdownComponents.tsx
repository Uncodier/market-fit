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
      className="text-xl font-bold mt-5 mb-2.5 border-b dark:border-white/5 border-black/5 pb-1" 
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
  
  // Links with proper color and hover, and media rendering for raw URLs
  a: ({ node, ...props }: any) => {
    const href = props.href || '';
    const lowerHref = href.toLowerCase();
    
    // Check if it's an image
    if (lowerHref.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/)) {
      const isRawUrl = typeof props.children === 'string' && props.children === href;
      const isArrayUrl = Array.isArray(props.children) && props.children.length === 1 && typeof props.children[0] === 'string' && props.children[0] === href;
      const hasCustomText = !isRawUrl && !isArrayUrl && props.children;

      return (
        <div className="my-4">
          <img 
            src={href} 
            alt="Image" 
            className="max-w-full h-auto rounded-md border dark:border-white/5 border-black/5 cursor-pointer hover:opacity-80 transition-opacity" 
            style={{ maxHeight: '400px', objectFit: 'contain' }}
            onClick={() => window.open(href, '_blank')}
          />
          {hasCustomText && (
            <div className="text-sm text-muted-foreground mt-2 text-center">
              <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {props.children}
              </a>
            </div>
          )}
        </div>
      );
    }
    
    // Check if it's a video
    if (lowerHref.match(/\.(mp4|webm|ogg)(\?.*)?$/)) {
      const isRawUrl = typeof props.children === 'string' && props.children === href;
      const isArrayUrl = Array.isArray(props.children) && props.children.length === 1 && typeof props.children[0] === 'string' && props.children[0] === href;
      const hasCustomText = !isRawUrl && !isArrayUrl && props.children;

      return (
        <div className="my-4">
          <video 
            src={href} 
            controls 
            className="max-w-full h-auto rounded-md border dark:border-white/5 border-black/5"
            style={{ maxHeight: '400px' }}
          />
          {hasCustomText && (
            <div className="text-sm text-muted-foreground mt-2 text-center">
              <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {props.children}
              </a>
            </div>
          )}
        </div>
      );
    }
    
    // Check if it's audio
    if (lowerHref.match(/\.(mp3|wav|ogg|m4a)(\?.*)?$/)) {
      const isRawUrl = typeof props.children === 'string' && props.children === href;
      const isArrayUrl = Array.isArray(props.children) && props.children.length === 1 && typeof props.children[0] === 'string' && props.children[0] === href;
      const hasCustomText = !isRawUrl && !isArrayUrl && props.children;

      return (
        <div className="my-4">
          <audio 
            src={href} 
            controls 
            className="w-full"
          />
          {hasCustomText && (
            <div className="text-sm text-muted-foreground mt-2 text-center">
              <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {props.children}
              </a>
            </div>
          )}
        </div>
      );
    }

    return (
      <a 
        className="text-primary hover:underline break-all" 
        target="_blank"
        rel="noopener noreferrer"
        {...props} 
      />
    );
  },
  
  // Images with responsive sizing
  img: ({ node, ...props }: any) => (
    <img 
      className="max-w-full h-auto my-2 rounded-md cursor-pointer hover:opacity-80 transition-opacity" 
      style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
      onClick={() => window.open(props.src, '_blank')}
      {...props} 
    />
  ),
  
  // Tables with horizontal scroll support
  table: ({ node, ...props }: any) => (
    <div className="overflow-x-auto my-2 w-full">
      <table 
        className="min-w-full border-collapse border dark:border-white/5 border-black/5" 
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
      className="border-b dark:border-white/5 border-black/5" 
      {...props} 
    />
  ),
  th: ({ node, ...props }: any) => (
    <th 
      className="px-4 py-2 text-left font-semibold border dark:border-white/5 border-black/5" 
      {...props} 
    />
  ),
  td: ({ node, ...props }: any) => (
    <td 
      className="px-4 py-2 border dark:border-white/5 border-black/5" 
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
      className="my-4 border-t dark:border-white/5 border-black/5" 
      {...props} 
    />
  ),
}

