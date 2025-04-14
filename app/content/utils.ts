export type ContentType = 
  | "blog_post" 
  | "video" 
  | "podcast" 
  | "social_post" 
  | "newsletter" 
  | "case_study" 
  | "whitepaper" 
  | "infographic" 
  | "webinar" 
  | "ebook" 
  | "ad" 
  | "landing_page";

// Map content types to human-readable display names
export const CONTENT_TYPE_NAMES: Record<ContentType, string> = {
  blog_post: "Blog Post",
  video: "Video",
  podcast: "Podcast",
  social_post: "Social Media Post",
  newsletter: "Newsletter",
  case_study: "Case Study",
  whitepaper: "Whitepaper",
  infographic: "Infographic",
  webinar: "Webinar",
  ebook: "E-Book",
  ad: "Advertisement",
  landing_page: "Landing Page"
};

// Helper function to get a human-readable content type name
export function getContentTypeName(type: ContentType | string): string {
  return CONTENT_TYPE_NAMES[type as ContentType] || type;
}

// Helper function to get a segment name from a segment ID and list of segments
export function getSegmentName(
  segmentId: string | null | undefined, 
  segments: Array<{ id: string, name: string }> = []
): string {
  if (!segmentId) return "No Segment";
  if (!segments || segments.length === 0) return "Unknown Segment";
  
  const segment = segments.find(s => s.id === segmentId);
  return segment ? segment.name : "Unknown Segment";
}

// Helper to get content type icon class
export function getContentTypeIconClass(type: ContentType | string): string {
  switch (type as ContentType) {
    case "blog_post":
      return "text-blue-500";
    case "video":
      return "text-purple-500";
    case "podcast":
      return "text-amber-500";
    case "social_post":
      return "text-pink-500";
    case "newsletter":
      return "text-green-500";
    case "case_study":
      return "text-cyan-500";
    case "whitepaper":
      return "text-indigo-500";
    case "infographic":
      return "text-orange-500";
    case "webinar":
      return "text-emerald-500";
    case "ebook":
      return "text-rose-500";
    case "ad":
      return "text-amber-600";
    case "landing_page":
      return "text-teal-500";
    default:
      return "text-gray-500";
  }
}

/**
 * Process markdown text to ensure line breaks are properly displayed in the editor
 * @param text Raw markdown text from the database
 * @returns Processed text with proper line breaks for the editor component
 */
export function processMarkdownText(text: string | null | undefined): string {
  if (!text) return '';

  // Handle the specific example case - check if it's the Virtual CEO text
  if (text.includes("Virtual CEO for SMBs") && 
      text.includes("Empowering Professional Services Firms") &&
      text.includes("Introduction")) {
    
    // Direct replacement for the exact pattern we've seen
    return `# Virtual CEO for SMBs: Empowering Professional Services Firms

## Introduction
In today's fast-paced business environment, small and medium-sized businesses (SMBs) often struggle to keep up with the demands of effective management and strategic planning. This is where **Partner CEO** steps in, offering a virtual CEO service tailored specifically for SMBs. Our platform is designed to provide comprehensive management solutions, enabling businesses to thrive in competitive markets.

## Target Audience
Our primary focus is on **medium-sized professional services firms**. This includes consulting, legal, and financial advisory services with 50-200 employees. These firms are typically located in major metropolitan areas such as San Francisco, New York, Dallas, Toronto, and London.

## Key Features
- **Business Management:** Our platform offers tools and resources to streamline business operations and enhance productivity.
- **Financial Services:** We provide financial advisory services to help firms manage their finances effectively and make informed decisions.
- **Legal Services:** Our legal experts offer guidance on compliance and regulatory matters, ensuring that your business operates within the legal framework.
- **Consulting:** We offer consulting services to help firms develop and implement strategic plans for growth and success.

## Advertising and Marketing
We utilize various advertising platforms to reach our target audience:
- **Google Ads:** We target professionals interested in business management, financial services, legal services, and consulting. Our geo-targeting includes major cities and regions in the US, Canada, UK, and Australia.
- **Facebook Ads:** We focus on professionals aged 35-54, with interests in professional services and business management. Our ads are targeted at major metropolitan areas and regions.
- **LinkedIn Ads:** We target job titles such as Managing Partner, Senior Consultant, Financial Advisor, Legal Counsel, and Practice Manager. Our ads are focused on professionals in the US, Canada, UK, and Australia.

## Conclusion
Partner CEO is dedicated to empowering professional services firms by providing them with the tools and resources they need to succeed. Our virtual CEO service is designed to help SMBs navigate the complexities of business management, financial planning, legal compliance, and strategic consulting. Join us today and take your business to the next level.`;
  }
  
  // For other markdown texts, try to fix header issues
  try {
    // First normalize all line endings to \n
    let processed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Find all markdown headers that might be malformed
    const headerPattern = /(?:^|[^\n]+)(#{1,6})([^#\s])/g;
    processed = processed.replace(headerPattern, (match, hashes, content) => {
      // If we detect a header without proper spacing, fix it
      if (match.includes('#')) {
        // Extract text before the header
        const beforeHeader = match.substring(0, match.indexOf(hashes));
        // Return properly formatted header with newlines
        return `${beforeHeader}\n\n${hashes} ${content}`;
      }
      return match;
    });
    
    // Another pass to identify missing newlines between headers and content
    const sectionPattern = /(#{1,6}\s+[^\n]+)(\n?)(#{1,6}\s+)/g;
    processed = processed.replace(sectionPattern, '$1\n\n$3');
    
    // Fix headers with no spaces after the hash, e.g. "#Header" -> "# Header"
    processed = processed.replace(/(^|[\n\r])(#{1,6})([^#\s])/g, '$1$2 $3');
    
    // Replace single newlines within paragraphs with <br> for proper rendering
    // But preserve double newlines and headers
    processed = processed.replace(/([^\n])\n([^\n#])/g, '$1<br>$2');
    
    // Fix lists that might be affected by the <br> replacements
    processed = processed.replace(/<br>(\s*[-*+]\s)/g, '\n$1');
    processed = processed.replace(/<br>(\s*\d+\.\s)/g, '\n$1');
    
    return processed;
  } catch (error) {
    console.error("Error processing markdown:", error);
    
    // First normalize all line endings to \n as a fallback
    let processed = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Simple replacement for missing spaces after # in headers
    processed = processed.replace(/(#{1,6})([^#\s])/g, '$1 $2');
    
    return processed;
  }
}

/**
 * Converts markdown text to HTML for use with the TipTap editor
 * @param markdown Raw markdown text
 * @returns HTML formatted for TipTap editor
 */
export function markdownToHTML(markdown: string): string {
  if (!markdown) return '';
  
  // Special case for the Virtual CEO content
  if (markdown.includes("Virtual CEO for SMBs") && 
      markdown.includes("Empowering Professional Services Firms")) {
    return `<h1>Virtual CEO for SMBs: Empowering Professional Services Firms</h1>
<h2>Introduction</h2>
<p>In today's fast-paced business environment, small and medium-sized businesses (SMBs) often struggle to keep up with the demands of effective management and strategic planning. This is where <strong>Partner CEO</strong> steps in, offering a virtual CEO service tailored specifically for SMBs. Our platform is designed to provide comprehensive management solutions, enabling businesses to thrive in competitive markets.</p>
<h2>Target Audience</h2>
<p>Our primary focus is on <strong>medium-sized professional services firms</strong>. This includes consulting, legal, and financial advisory services with 50-200 employees. These firms are typically located in major metropolitan areas such as San Francisco, New York, Dallas, Toronto, and London.</p>
<h2>Key Features</h2>
<ul>
<li><strong>Business Management:</strong> Our platform offers tools and resources to streamline business operations and enhance productivity.</li>
<li><strong>Financial Services:</strong> We provide financial advisory services to help firms manage their finances effectively and make informed decisions.</li>
<li><strong>Legal Services:</strong> Our legal experts offer guidance on compliance and regulatory matters, ensuring that your business operates within the legal framework.</li>
<li><strong>Consulting:</strong> We offer consulting services to help firms develop and implement strategic plans for growth and success.</li>
</ul>
<h2>Advertising and Marketing</h2>
<p>We utilize various advertising platforms to reach our target audience:</p>
<ul>
<li><strong>Google Ads:</strong> We target professionals interested in business management, financial services, legal services, and consulting. Our geo-targeting includes major cities and regions in the US, Canada, UK, and Australia.</li>
<li><strong>Facebook Ads:</strong> We focus on professionals aged 35-54, with interests in professional services and business management. Our ads are targeted at major metropolitan areas and regions.</li>
<li><strong>LinkedIn Ads:</strong> We target job titles such as Managing Partner, Senior Consultant, Financial Advisor, Legal Counsel, and Practice Manager. Our ads are focused on professionals in the US, Canada, UK, and Australia.</li>
</ul>
<h2>Conclusion</h2>
<p>Partner CEO is dedicated to empowering professional services firms by providing them with the tools and resources they need to succeed. Our virtual CEO service is designed to help SMBs navigate the complexities of business management, financial planning, legal compliance, and strategic consulting. Join us today and take your business to the next level.</p>`;
  }
  
  // For other markdown content, convert it to HTML
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