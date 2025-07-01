// Function to convert HTML back to markdown
export const htmlToMarkdown = (html: string): string => {
  if (!html) return '';
  
  try {
    // Create a temporary element to parse HTML
    const tempElement = document.createElement('div');
    tempElement.innerHTML = html;
    
    // Function to convert DOM node to markdown
    const nodeToMarkdown = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
      }
      
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        const children = Array.from(element.childNodes).map(nodeToMarkdown).join('');
        
        switch (element.tagName.toLowerCase()) {
          case 'h1':
            return `# ${children}\n\n`;
          case 'h2':
            return `## ${children}\n\n`;
          case 'h3':
            return `### ${children}\n\n`;
          case 'h4':
            return `#### ${children}\n\n`;
          case 'h5':
            return `##### ${children}\n\n`;
          case 'h6':
            return `###### ${children}\n\n`;
          case 'p':
            return `${children}\n\n`;
          case 'strong':
          case 'b':
            return `**${children}**`;
          case 'em':
          case 'i':
            return `*${children}*`;
          case 'ul':
            return `${children}\n`;
          case 'ol':
            return `${children}\n`;
          case 'li':
            return `- ${children}\n`;
          case 'blockquote':
            return `> ${children}\n\n`;
          case 'code':
            return `\`${children}\``;
          case 'pre':
            return `\`\`\`\n${children}\n\`\`\`\n\n`;
          case 'br':
            return '\n';
          case 'a':
            const href = element.getAttribute('href');
            return href ? `[${children}](${href})` : children;
          case 'img':
            const src = element.getAttribute('src');
            const alt = element.getAttribute('alt') || '';
            return src ? `![${alt}](${src})` : '';
          default:
            return children;
        }
      }
      
      return '';
    };
    
    const markdown = nodeToMarkdown(tempElement);
    
    // Clean up extra newlines
    return markdown
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ newlines with 2
      .trim();
    
  } catch (error) {
    console.error("Error converting HTML to markdown:", error);
    // Fallback: strip HTML tags
    return html.replace(/<[^>]*>/g, '').trim();
  }
} 