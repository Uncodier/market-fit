import json
import re

with open('lib/demo-data/demo-saas-en-123.ts', 'r') as f:
    content = f.read()

# Add instance_logs and commands at the end of the object
if 'instance_logs:' not in content:
    content = content.replace('};', """,
  commands: [
    {
      id: 'cmd-saas-1',
      uuid: 'cmd-saas-1',
      task: 'Process new enterprise lead',
      status: 'completed',
      user_id: 'demo-user-123',
      description: 'Webhook triggered pipeline',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3500000).toISOString()
    }
  ],
  instance_logs: [
    {
      id: 'log-saas-1',
      log_type: 'system',
      level: 'info',
      message: 'Webhook received new lead data',
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-1',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'log-saas-2',
      log_type: 'tool_call',
      level: 'info',
      message: 'Calling clearbit to enrich company data',
      tool_name: 'clearbit_enrich',
      tool_args: { domain: 'innovate-llc.com' },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-1',
      created_at: new Date(Date.now() - 3595000).toISOString()
    },
    {
      id: 'log-saas-3',
      log_type: 'tool_result',
      level: 'info',
      message: 'Company enriched successfully',
      tool_name: 'clearbit_enrich',
      tool_result: { employees: 250, industry: 'software', revenue: '$10M-50M' },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-1',
      created_at: new Date(Date.now() - 3590000).toISOString()
    },
    {
      id: 'log-saas-4',
      log_type: 'agent_action',
      level: 'info',
      message: 'Sending Welcome Email based on industry profile',
      details: { template_used: 'software_enterprise_welcome' },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-1',
      created_at: new Date(Date.now() - 3585000).toISOString()
    }
  ]
};""")

# Add more leads
leads_replacement = """  leads: [
    {
      id: 'lead-saas-1',
      site_id: 'demo-saas-en-123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      company: 'Tech Corp',
      status: 'new',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'lead-saas-2',
      site_id: 'demo-saas-en-123',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      company: 'Innovate LLC',
      status: 'contacted',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: 'lead-saas-3',
      site_id: 'demo-saas-en-123',
      name: 'Michael Johnson',
      email: 'michael.j@cloudsystems.net',
      company: 'Cloud Systems',
      status: 'qualified',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
      id: 'lead-saas-4',
      site_id: 'demo-saas-en-123',
      name: 'Sarah Williams',
      email: 'swilliams@datatech.io',
      company: 'DataTech',
      status: 'converted',
      created_at: new Date(Date.now() - 86400000 * 12).toISOString()
    },
    {
      id: 'lead-saas-5',
      site_id: 'demo-saas-en-123',
      name: 'David Brown',
      email: 'dbrown@legacycorp.com',
      company: 'Legacy Corp',
      status: 'lost',
      created_at: new Date(Date.now() - 86400000 * 20).toISOString()
    },
    {
      id: 'lead-saas-6',
      site_id: 'demo-saas-en-123',
      name: 'Emily Davis',
      email: 'emily.davis@startup.ai',
      company: 'Startup AI',
      status: 'new',
      created_at: new Date(Date.now() - 3600000 * 5).toISOString()
    }
  ],"""
content = re.sub(r"  leads: \[.*?  \],", leads_replacement, content, flags=re.DOTALL)

# Add more companies
companies_replacement = """  companies: [
    {
      id: 'company-saas-1',
      name: 'Tech Corp',
      industry: 'technology',
      size: '51-200',
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'company-saas-2',
      name: 'Cloud Systems',
      industry: 'software',
      size: '201-500',
      created_at: new Date(Date.now() - 86400000 * 25).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'company-saas-3',
      name: 'DataTech',
      industry: 'data_analytics',
      size: '11-50',
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'company-saas-4',
      name: 'Global Finance Inc',
      industry: 'finance',
      size: '1000+',
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],"""
content = re.sub(r"  companies: \[.*?  \],", companies_replacement, content, flags=re.DOTALL)

# Add more deals
deals_replacement = """  deals: [
    {
      id: 'deal-saas-1',
      name: 'Enterprise License Tech Corp',
      amount: 25000,
      currency: 'USD',
      stage: 'proposal',
      status: 'open',
      company_id: 'company-saas-1',
      site_id: 'demo-saas-en-123',
      expected_close_date: new Date(Date.now() + 86400000 * 15).toISOString(),
      notes: 'Evaluating our security compliance before signing',
      qualification_score: 92,
      qualification_criteria: { 'budget': true, 'authority': false, 'need': true, 'timeline': true },
      sales_order_id: null,
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'deal-saas-2',
      name: 'Cloud Systems Team Plan',
      amount: 12000,
      currency: 'USD',
      stage: 'negotiation',
      status: 'open',
      company_id: 'company-saas-2',
      site_id: 'demo-saas-en-123',
      expected_close_date: new Date(Date.now() + 86400000 * 5).toISOString(),
      notes: 'Finalizing legal review of MSA',
      qualification_score: 85,
      qualification_criteria: { 'budget': true, 'authority': true, 'need': true, 'timeline': true },
      sales_order_id: null,
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'deal-saas-3',
      name: 'DataTech Annual Sub',
      amount: 8500,
      currency: 'USD',
      stage: 'closed_won',
      status: 'won',
      company_id: 'company-saas-3',
      site_id: 'demo-saas-en-123',
      expected_close_date: new Date(Date.now() - 86400000 * 2).toISOString(),
      notes: 'Successfully onboarded 15 users',
      qualification_score: 95,
      qualification_criteria: { 'budget': true, 'authority': true, 'need': true, 'timeline': true },
      sales_order_id: null,
      created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'deal-saas-4',
      name: 'Global Finance Pilot',
      amount: 50000,
      currency: 'USD',
      stage: 'prospecting',
      status: 'open',
      company_id: 'company-saas-4',
      site_id: 'demo-saas-en-123',
      expected_close_date: new Date(Date.now() + 86400000 * 60).toISOString(),
      notes: 'Just had initial discovery call. Huge potential if we pass infosec.',
      qualification_score: 65,
      qualification_criteria: { 'budget': false, 'authority': false, 'need': true, 'timeline': false },
      sales_order_id: null,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'deal-saas-5',
      name: 'Legacy Corp Migration',
      amount: 18000,
      currency: 'USD',
      stage: 'closed_lost',
      status: 'lost',
      company_id: null,
      site_id: 'demo-saas-en-123',
      expected_close_date: new Date(Date.now() - 86400000 * 10).toISOString(),
      notes: 'Chose competitor due to deeper integration with their legacy systems',
      qualification_score: 55,
      qualification_criteria: { 'budget': true, 'authority': true, 'need': false, 'timeline': true },
      sales_order_id: null,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 10).toISOString()
    }
  ],"""
content = re.sub(r"  deals: \[.*?  \],", deals_replacement, content, flags=re.DOTALL)

with open('lib/demo-data/demo-saas-en-123.ts', 'w') as f:
    f.write(content)
