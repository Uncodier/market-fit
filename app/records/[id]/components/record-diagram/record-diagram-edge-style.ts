import type { RecordEdgeType } from "@/app/records/lib/record-diagram"

export type RecordEdgeVisualStyle = {
  strokeWidth: number
  strokeDasharray?: string
  strokeLinecap: "butt" | "round"
  chipBorderStyle: "solid" | "dashed" | "dotted"
}

const EDGE_STYLES: Record<RecordEdgeType, RecordEdgeVisualStyle> = {
  relates_to: {
    strokeWidth: 2,
    strokeLinecap: "round",
    chipBorderStyle: "solid",
  },
  supports: {
    strokeWidth: 3,
    strokeLinecap: "round",
    chipBorderStyle: "solid",
  },
  contradicts: {
    strokeWidth: 2.5,
    strokeDasharray: "8 5",
    strokeLinecap: "butt",
    chipBorderStyle: "dashed",
  },
  causes: {
    strokeWidth: 3.5,
    strokeLinecap: "round",
    chipBorderStyle: "solid",
  },
  contains: {
    strokeWidth: 2.5,
    strokeDasharray: "14 5",
    strokeLinecap: "butt",
    chipBorderStyle: "dashed",
  },
  references: {
    strokeWidth: 2,
    strokeDasharray: "2 5",
    strokeLinecap: "round",
    chipBorderStyle: "dotted",
  },
}

export function getRecordEdgeVisualStyle(type: RecordEdgeType) {
  return EDGE_STYLES[type]
}
