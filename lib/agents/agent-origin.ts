export const INDEPENDENT_AGENT_ORIGIN = 'independent'
// A plain `neq` comparison excludes JSON null/missing values in PostgREST.
export const TEMPLATE_AGENT_FILTER = `configuration->>agentOrigin.is.null,configuration->>agentOrigin.neq.${INDEPENDENT_AGENT_ORIGIN}`