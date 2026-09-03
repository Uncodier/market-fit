function stripMarkdown(text) {
  if (!text) return "";
  return text
    // Remove headers
    .replace(/^#+\s+/gm, '')
    // Remove bold/italic
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove links
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    // Remove images
    .replace(/!\[(.*?)\]\(.*?\)/g, '$1')
    // Remove blockquotes
    .replace(/^\s*>\s+/gm, '')
    // Remove unordered lists
    .replace(/^\s*[-\*+]\s+/gm, '')
    // Remove ordered lists
    .replace(/^\s*\d+\.\s+/gm, '')
    // Replace newlines with spaces
    .replace(/\n+/g, ' ')
    .trim();
}

const md = `**Sinopsis:**\nCoraline es una película de animación...\n\n**Ficha Técnica:**\n- **Director:** Henry Selick`;
console.log(stripMarkdown(md));
