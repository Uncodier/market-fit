export type GraphNodeType = 'record' | 'entity';

export interface GraphPreviewField {
  label: string
  value: string
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  summary?: string;
  previewFields?: GraphPreviewField[];
  categoryName?: string;
  entityType?: string;
  color?: string;
  val: number;
  isCurrent?: boolean;
}

export type GraphEdgeType = 'relation' | 'similarity';

export interface GraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
  label?: string;
  similarity?: number;
  color?: string;
}

export function excerptText(value: unknown, max = 110): string {
  if (value == null) return ""
  const raw = typeof value === "string" ? value : JSON.stringify(value)
  const text = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_`>~]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return ""
  return text.length > max ? `${text.slice(0, max).trim()}…` : text
}

export function summarizeRecord(record: any): string {
  const fromDescription = excerptText(record.description, 120)
  if (fromDescription) return fromDescription

  const data = record.data && typeof record.data === "object" ? record.data : {}
  const highlights = Object.entries(data)
    .filter(([, value]) => typeof value === "string" || typeof value === "number")
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${excerptText(value, 40)}`)

  if (highlights.length) return highlights.join(" · ")
  if (record.category?.name) return record.category.name
  return "No summary yet"
}

export function formatRelationLabel(fieldName: string): string {
  return fieldName.replace(/[_-]+/g, " ").trim()
}

export function formatEntityTypeLabel(entityType?: string): string {
  if (!entityType) return "Entity"
  const labels: Record<string, string> = {
    lead: "Lead",
    company: "Company",
    sales_order: "Sales order",
    deal: "Deal",
    person: "Person",
    team_member: "Team member",
    campaign: "Campaign",
    catalog_item: "Catalog item",
    content: "Content",
    task: "Task",
    sale: "Sale",
    purchase: "Purchase",
    quotation: "Quotation",
    record: "Record",
    record_category: "Category",
  }
  return labels[entityType] || formatRelationLabel(entityType)
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphEdge[];
}

// Convert Tailwind CSS variable format (e.g., "210 40% 98%") to rgb(a) or hex
// We'll use a simple hash function for category colors to keep it deterministic without hardcoding
export function getCategoryColor(categoryName: string): string {
  if (!categoryName) return '#94a3b8'; // slate-400
  
  let hash = 0;
  for (let i = 0; i < categoryName.length; i++) {
    hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 70%, 50%)`;
}

export function getEntityColor(): string {
  return '#cbd5e1'; // slate-300
}

export function buildGraphData(
  records: any[],
  similarityEdges: { source_id: string; target_id: string; similarity: number }[],
  resolvedRelations: Record<string, string>,
  options: {
    showRelations?: boolean;
    showSimilarity?: boolean;
    showEntities?: boolean;
    similarityThreshold?: number;
    currentRecordId?: string
    entityPreviews?: Record<string, { label: string; summary: string; fields: GraphPreviewField[] }>
  } = {}
): GraphData {
  const {
    showRelations = true,
    showSimilarity = true,
    showEntities = true,
    similarityThreshold = 0.5,
    currentRecordId,
    entityPreviews = {},
  } = options;

  const nodes = new Map<string, GraphNode>();
  const links: GraphEdge[] = [];

  // Add all records as nodes
  records.forEach(record => {
    const isCurrent = record.id === currentRecordId;
    nodes.set(record.id, {
      id: record.id,
      type: 'record',
      label: record.title || 'Untitled',
      summary: summarizeRecord(record),
      categoryName: record.category?.name,
      color: getCategoryColor(record.category?.name),
      val: isCurrent ? 22 : 14,
      isCurrent
    });
  });

  // Process relations (explicit edges)
  if (showRelations) {
    records.forEach(record => {
      if (!record.relations || !record.category?.template_fields) return;

      const templateFields = record.category.template_fields;
      
      Object.entries(record.relations).forEach(([fieldName, targetId]) => {
        if (!targetId || typeof targetId !== 'string') return;
        
        const fieldDef = templateFields.find((f: any) => f.name === fieldName);
        if (!fieldDef) return;

        const isRecordToRecord = fieldDef.relationTarget === 'record';

        // Add edge
        if (isRecordToRecord) {
          if (!nodes.has(targetId)) {
            const preview = entityPreviews[targetId]
            nodes.set(targetId, {
              id: targetId,
              type: 'record',
              label: preview?.label || resolvedRelations[targetId] || 'Record',
              summary: preview?.summary || preview?.fields?.map((field) => field.value).join(" · ") || "Linked record",
              previewFields: preview?.fields,
              color: getCategoryColor('Record'),
              val: 14
            });
          }
          links.push({
            source: record.id,
            target: targetId,
            type: 'relation',
            label: formatRelationLabel(fieldName),
            color: '#94a3b8'
          });
        } else if (showEntities) {
          // Create an entity node if it doesn't exist
          if (!nodes.has(targetId)) {
            const preview = entityPreviews[targetId]
            const entityType = fieldDef.relationTarget || 'lead'
            const label = preview?.label || resolvedRelations[targetId] || `${entityType} (${targetId.substring(0,6)})`;
            nodes.set(targetId, {
              id: targetId,
              type: 'entity',
              label,
              summary: preview?.summary || formatEntityTypeLabel(entityType),
              previewFields: preview?.fields,
              categoryName: formatEntityTypeLabel(entityType),
              entityType,
              color: getEntityColor(),
              val: 8
            });
          }
          
          links.push({
            source: record.id,
            target: targetId,
            type: 'relation',
            label: formatRelationLabel(fieldName),
            color: '#94a3b8'
          });
        }
      });
    });
  }

  // Process similarity edges
  if (showSimilarity && similarityEdges) {
    similarityEdges.forEach(edge => {
      if (edge.similarity < similarityThreshold) return;
      
      // Only add edge if both nodes exist in our set
      if (nodes.has(edge.source_id) && nodes.has(edge.target_id)) {
        // Calculate opacity based on similarity (min 0.2, max 0.8)
        const opacity = Math.max(0.2, Math.min(0.8, edge.similarity));
        
        links.push({
          source: edge.source_id,
          target: edge.target_id,
          type: 'similarity',
          similarity: edge.similarity,
          label: `${Math.round(edge.similarity * 100)}% similar`,
          color: `rgba(168, 85, 247, ${opacity})`
        });
      }
    });
  }

  // Calculate node degree for sizing record nodes
  if (!currentRecordId) {
    const degreeCount = new Map<string, number>();
    links.forEach(l => {
      const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
      const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
      
      degreeCount.set(sourceId, (degreeCount.get(sourceId) || 0) + 1);
      degreeCount.set(targetId, (degreeCount.get(targetId) || 0) + 1);
    });

    nodes.forEach(node => {
      if (node.type === 'record') {
        const degree = degreeCount.get(node.id) || 0;
        node.val = Math.max(10, Math.min(30, 10 + (degree * 1.5)));
      }
    });
  }

  return {
    nodes: Array.from(nodes.values()),
    links
  };
}