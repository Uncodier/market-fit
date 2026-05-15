import re

with open('lib/demo-data/demo-saas-en-123.ts', 'r') as f:
    content = f.read()

nodes_saas_new = """  instance_nodes: [
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
    },
    {
      id: 'node-saas-3',
      site_id: 'demo-saas-en-123',
      instance_id: 'remote-saas-1',
      user_id: 'demo-user-123',
      type: 'action',
      title: 'Send Welcome Email',
      prompt: { text: 'Send personalized welcome email based on industry segment' },
      settings: { template_used: 'software_enterprise_welcome', schedule: 'immediate' },
      result: { email_sent: true, to: 'swilliams@datatech.io', template: 'software_enterprise_welcome' },
      status: 'completed',
      position_x: 800,
      position_y: 100,
      width: 280,
      created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  instance_node_contexts: [
    {
      id: 'edge-saas-1',
      source_node_id: 'node-saas-1',
      target_node_id: 'node-saas-2',
      label: 'On Success'
    },
    {
      id: 'edge-saas-2',
      source_node_id: 'node-saas-2',
      target_node_id: 'node-saas-3',
      label: 'If Enriched'
    }
  ],"""

content = re.sub(r"  instance_nodes: \[.*?  \],\s*instance_node_contexts: \[.*?  \],", nodes_saas_new, content, flags=re.DOTALL)

with open('lib/demo-data/demo-saas-en-123.ts', 'w') as f:
    f.write(content)

