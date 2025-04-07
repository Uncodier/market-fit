/**
 * Helper function to extract segment ID regardless of format (object or string)
 */
export function getSegmentId(segment: any): string | null {
  if (typeof segment === 'string') {
    return segment;
  } else if (segment && typeof segment === 'object' && 'id' in segment) {
    return segment.id;
  }
  return null;
}

/**
 * Check if a string is a valid UUID
 */
export function isValidUUID(str: string): boolean {
  // UUID pattern: 8-4-4-4-12 hex digits
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(str);
}

/**
 * Process segment IDs from various formats
 * Returns an object with categorized segment IDs
 */
export function processSegmentIds(segments: any[] | undefined) {
  if (!Array.isArray(segments) || segments.length === 0) {
    return {
      allSegmentIds: [],
      databaseSegmentIds: [],
      mockSegmentIds: []
    };
  }

  // Extract all segment IDs from either strings or objects
  const allSegmentIds = segments
    .map(segment => getSegmentId(segment))
    .filter(id => id !== null) as string[];

  // Separate real database segments from mock segments
  const databaseSegmentIds = allSegmentIds.filter(id => {
    const normalizedId = String(id).trim();
    return isValidUUID(normalizedId) && !normalizedId.startsWith('s-');
  });

  const mockSegmentIds = allSegmentIds.filter(id => {
    const normalizedId = String(id).trim();
    return normalizedId.startsWith('s-') || !isValidUUID(normalizedId);
  });

  return {
    allSegmentIds,
    databaseSegmentIds,
    mockSegmentIds
  };
}

/**
 * Create campaign-segment relations for database insertion
 */
export function createSegmentRelations(campaignId: string, segmentIds: string[]) {
  return segmentIds.map(segmentId => ({
    campaign_id: campaignId,
    segment_id: segmentId
  }));
} 