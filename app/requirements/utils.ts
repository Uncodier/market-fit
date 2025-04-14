/**
 * Converts markdown text to HTML for use with the TipTap editor
 * @param markdown Raw markdown text
 * @returns HTML formatted for TipTap editor
 */
export function markdownToHTML(markdown: string): string {
  if (!markdown) return '';
  
  // For markdown content, convert it to HTML
  try {
    // First normalize all line endings to \n
    let normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Fix problematic header patterns
    normalized = normalized.replace(/(#{1,6})([^#\s])/g, '$1 $2');
    
    // Convert headers
    normalized = normalized.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    normalized = normalized.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    normalized = normalized.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    normalized = normalized.replace(/^#### (.*?)$/gm, '<h4>$1</h4>');
    normalized = normalized.replace(/^##### (.*?)$/gm, '<h5>$1</h5>');
    normalized = normalized.replace(/^###### (.*?)$/gm, '<h6>$1</h6>');
    
    // Convert lists
    // First, find all list blocks and process them
    normalized = normalized.replace(/^([ \t]*)-\s+(.*?)$/gm, '<li>$2</li>');
    
    // Convert paragraphs (any text not already in an HTML tag)
    normalized = normalized.replace(/^([^<\n].*?)$/gm, '<p>$1</p>');
    
    // Fix double paragraph wraps
    normalized = normalized.replace(/<p><p>/g, '<p>');
    normalized = normalized.replace(/<\/p><\/p>/g, '</p>');
    
    // Convert bold text
    normalized = normalized.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert italic text
    normalized = normalized.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Wrap lists in ul tags
    normalized = normalized.replace(/(<li>.*?<\/li>(\n|$))+/g, '<ul>$&</ul>');
    
    // Fix any broken HTML
    normalized = normalized.replace(/<\/li><\/ul><ul><li>/g, '</li><li>');
    
    return normalized;
  } catch (error) {
    console.error("Error converting markdown to HTML:", error);
    return `<p>${markdown}</p>`;
  }
} 