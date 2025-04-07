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
export function getContentTypeName(contentType: ContentType | string): string {
  return CONTENT_TYPE_NAMES[contentType as ContentType] || contentType;
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
export function getContentTypeIconClass(contentType: ContentType | string): string {
  switch (contentType as ContentType) {
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