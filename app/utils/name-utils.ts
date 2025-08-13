/**
 * Utility functions for handling name truncation in the chat interface
 * 
 * Character distribution:
 * - Agent names: 40% of available space
 * - Lead/Visitor names: 60% of available space
 */

interface NameTruncationOptions {
  maxAgentChars?: number;
  maxLeadChars?: number;
  totalMaxChars?: number;
}

/**
 * Default character limits based on typical UI constraints
 * Total space assumed: ~50 characters for both names combined
 */
const DEFAULT_TOTAL_CHARS = 50;
const AGENT_PERCENTAGE = 0.4;
const LEAD_PERCENTAGE = 0.6;

export const DEFAULT_AGENT_MAX_CHARS = Math.floor(DEFAULT_TOTAL_CHARS * AGENT_PERCENTAGE); // 20 chars
export const DEFAULT_LEAD_MAX_CHARS = Math.floor(DEFAULT_TOTAL_CHARS * LEAD_PERCENTAGE); // 30 chars

/**
 * Truncates a name to the specified character limit with ellipsis
 */
export function truncateName(name: string, maxChars: number): string {
  if (!name || name.length <= maxChars) {
    return name;
  }
  
  return name.substring(0, maxChars - 3) + "...";
}

/**
 * Truncates agent name with default or custom character limit (40% of total space)
 */
export function truncateAgentName(name: string, maxChars: number = DEFAULT_AGENT_MAX_CHARS): string {
  return truncateName(name, maxChars);
}

/**
 * Truncates lead/visitor name with default or custom character limit (60% of total space)
 */
export function truncateLeadName(name: string, maxChars: number = DEFAULT_LEAD_MAX_CHARS): string {
  return truncateName(name, maxChars);
}

/**
 * Truncates both agent and lead names based on available space distribution
 */
export function truncateNames(
  agentName: string, 
  leadName: string, 
  options: NameTruncationOptions = {}
): { truncatedAgentName: string; truncatedLeadName: string } {
  const {
    maxAgentChars = DEFAULT_AGENT_MAX_CHARS,
    maxLeadChars = DEFAULT_LEAD_MAX_CHARS
  } = options;

  return {
    truncatedAgentName: truncateAgentName(agentName, maxAgentChars),
    truncatedLeadName: truncateLeadName(leadName, maxLeadChars)
  };
}

/**
 * Special truncation for conversation list items (smaller space available)
 */
export function truncateConversationNames(agentName: string, leadName: string): {
  truncatedAgentName: string;
  truncatedLeadName: string;
} {
  // Smaller limits for conversation list
  const CONVERSATION_AGENT_MAX = 15; // 40% of ~25 total chars
  const CONVERSATION_LEAD_MAX = 15;  // 60% of ~25 total chars, but keeping same for balance
  
  return {
    truncatedAgentName: truncateAgentName(agentName, CONVERSATION_AGENT_MAX),
    truncatedLeadName: truncateLeadName(leadName, CONVERSATION_LEAD_MAX)
  };
}
