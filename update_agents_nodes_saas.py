import json
import re

with open('lib/demo-data/demo-saas-en-123.ts', 'r') as f:
    content = f.read()

# SAAS AGENTS
agents_saas = """  agents: [
    {
      id: 'agent-saas-1',
      site_id: 'demo-saas-en-123',
      name: 'Sales Rep Bot',
      description: 'First line of contact for enterprise leads evaluating the BI platform',
      type: 'sales',
      status: 'active',
      prompt: 'You are the Enterprise Sales Rep for Acme Analytics. Your goal is to qualify inbound leads (employee count, budget) and book demo meetings. Share security compliance documents if requested.',
      conversations: 412,
      success_rate: 42.8,
      configuration: { temperature: 0.4, model: 'gpt-4o' },
      role: 'SDR (Sales Development Rep)',
      tools: ['book_meeting', 'share_document', 'qualify_lead'],
      activities: ['Qualified Sarah Williams from DataTech', 'Booked Enterprise Demo for Tuesday 10AM'],
      integrations: ['hubspot', 'calendly', 'clearbit'],
      user_id: 'demo-user-123',
      created_at: new Date(Date.now() - 86400000 * 90).toISOString(),
      updated_at: new Date().toISOString(),
      last_active: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'agent-saas-2',
      site_id: 'demo-saas-en-123',
      name: 'Support Assistant',
      description: 'L1 technical support for existing customers',
      type: 'support',
      status: 'active',
      prompt: 'You are L1 Support for Acme Analytics. Help users with login issues, dashboard creation, and basic API queries. Escalate to human agents if the issue takes more than 3 turns.',
      conversations: 850,
      success_rate: 85.1,
      configuration: { temperature: 0.2, model: 'gpt-4o-mini' },
      role: 'Support Specialist',
      tools: ['search_docs', 'check_status', 'create_ticket'],
      activities: ['Resolved 15 tickets today', 'Escalated API rate limit issue'],
      integrations: ['zendesk', 'jira'],
      user_id: 'demo-user-123',
      created_at: new Date(Date.now() - 86400000 * 120).toISOString(),
      updated_at: new Date().toISOString(),
      last_active: new Date(Date.now() - 1800000).toISOString()
    }
  ],"""
content = re.sub(r"  agents: \[.*?  \],", agents_saas, content, flags=re.DOTALL)

# SAAS NODES
nodes_saas = """  instance_nodes: [
    {
      id: 'node-saas-1',
      site_id: 'demo-saas-en-123',
      instance_id: 'remote-saas-1',
      user_id: 'demo-user-123',
      type: 'trigger',
      title: 'New Lead Webhook',
      prompt: { text: 'Listen for new leads registering to the Acme AI in Analytics Webinar' },
      settings: { source: 'webhook', webhook_url: 'https://api.acme.com/webhooks/leads' },
      result: { trigger_activated: true, lead_email: 'swilliams@datatech.io', source: 'Webinar' },
      status: 'completed',
      position_x: 100,
      position_y: 100,
      width: 280,
      created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-saas-2',
      site_id: 'demo-saas-en-123',
      instance_id: 'remote-saas-1',
      user_id: 'demo-user-123',
      type: 'action',
      title: 'Enrich via Clearbit',
      prompt: { text: 'Use the lead email domain to fetch company size and industry. Assign to Enterprise segment if employees > 50.' },
      settings: { enrichment_provider: 'clearbit', auto_segment: true },
      result: { enriched: true, company: 'DataTech', employees: 150, segment_assigned: 'seg-saas-1' },
      status: 'completed',
      position_x: 450,
      position_y: 100,
      width: 280,
      created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],"""
content = re.sub(r"  instance_nodes: \[.*?  \],", nodes_saas, content, flags=re.DOTALL)

with open('lib/demo-data/demo-saas-en-123.ts', 'w') as f:
    f.write(content)

