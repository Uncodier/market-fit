import json
import re

with open('lib/demo-data/demo-saas-en-123.ts', 'r') as f:
    content = f.read()

# Replace Sarah Williams lead with proper linkage
sarah_lead = """    {
      id: 'lead-saas-4',
      site_id: 'demo-saas-en-123',
      name: 'Sarah Williams',
      email: 'swilliams@datatech.io',
      company: 'DataTech',
      status: 'converted',
      created_at: new Date(Date.now() - 86400000 * 12).toISOString()
    },"""

sarah_lead_new = """    {
      id: 'lead-saas-4',
      site_id: 'demo-saas-en-123',
      name: 'Sarah Williams',
      email: 'swilliams@datatech.io',
      company: 'DataTech',
      status: 'converted',
      segment_id: 'seg-saas-1',
      created_at: new Date(Date.now() - 86400000 * 45).toISOString()
    },"""

content = content.replace(sarah_lead, sarah_lead_new)

# Update DataTech Company
datatech = """    {
      id: 'company-saas-3',
      name: 'DataTech',
      industry: 'data_analytics',
      size: '11-50',
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      updated_at: new Date().toISOString()
    },"""
datatech_new = """    {
      id: 'company-saas-3',
      name: 'DataTech',
      industry: 'technology',
      size: '51-200',
      created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
      updated_at: new Date().toISOString()
    },"""
content = content.replace(datatech, datatech_new)

# Update DataTech Deal
datatech_deal = """    {
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
    },"""
datatech_deal_new = """    {
      id: 'deal-saas-3',
      name: 'DataTech Annual Sub',
      amount: 25000,
      currency: 'USD',
      stage: 'proposal',
      status: 'open',
      company_id: 'company-saas-3',
      site_id: 'demo-saas-en-123',
      expected_close_date: new Date(Date.now() + 86400000 * 15).toISOString(),
      notes: 'Sarah is pushing for the Enterprise tier. Evaluating our security compliance before signing.',
      qualification_score: 95,
      qualification_criteria: { 'budget': true, 'authority': true, 'need': true, 'timeline': true },
      sales_order_id: null,
      created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },"""
content = content.replace(datatech_deal, datatech_deal_new)

# Update tasks
tasks_saas = """  tasks: [
    {
      id: 'task-saas-1',
      site_id: 'demo-saas-en-123',
      title: 'Review Q3 Metrics',
      status: 'pending',
      priority: 'high',
      due_date: new Date(Date.now() + 86400000).toISOString(),
      created_at: new Date().toISOString()
    },
    {
      id: 'task-saas-2',
      site_id: 'demo-saas-en-123',
      title: 'Prepare demo for Global Finance',
      status: 'in_progress',
      priority: 'high',
      due_date: new Date(Date.now() + 86400000 * 2).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
      id: 'task-saas-3',
      site_id: 'demo-saas-en-123',
      title: 'Update onboarding documentation',
      status: 'completed',
      priority: 'low',
      due_date: new Date(Date.now() - 86400000 * 5).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 15).toISOString()
    }
  ],"""
tasks_saas_new = """  tasks: [
    {
      id: 'task-saas-1',
      site_id: 'demo-saas-en-123',
      title: 'Prepare Security Compliance Doc for DataTech',
      status: 'in_progress',
      priority: 'high',
      due_date: new Date(Date.now() + 86400000).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'task-saas-2',
      site_id: 'demo-saas-en-123',
      title: 'Follow up demo for DataTech',
      status: 'completed',
      priority: 'high',
      due_date: new Date(Date.now() - 86400000 * 1).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: 'task-saas-3',
      site_id: 'demo-saas-en-123',
      title: 'Send ROI Calculator to Tech Corp',
      status: 'pending',
      priority: 'normal',
      due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
      created_at: new Date().toISOString()
    }
  ],"""
content = re.sub(r"  tasks: \[.*?  \],", tasks_saas_new, content, flags=re.DOTALL)

# Update Conversations and Messages
convs = """  conversations: [
    {
      id: 'conv-saas-1',
      site_id: 'demo-saas-en-123',
      lead_id: 'lead-saas-1',
      status: 'active',
      channel: 'whatsapp',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'conv-saas-2',
      site_id: 'demo-saas-en-123',
      agent_id: 'agent-saas-1',
      title: 'Chat with Sales Rep Bot',
      status: 'active',
      channel: 'web',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'conv-saas-3',
      site_id: 'demo-saas-en-123',
      command_id: 'node-saas-1',
      title: 'Node Execution: New Lead Pipeline',
      status: 'active',
      channel: 'web',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],"""
convs_new = """  conversations: [
    {
      id: 'conv-saas-1',
      site_id: 'demo-saas-en-123',
      lead_id: 'lead-saas-4',
      agent_id: 'agent-saas-1',
      title: 'Chat with Sarah Williams (DataTech)',
      status: 'active',
      channel: 'web',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: 'conv-saas-3',
      site_id: 'demo-saas-en-123',
      command_id: 'node-saas-1',
      title: 'Node Execution: New Lead Pipeline',
      status: 'active',
      channel: 'web',
      created_at: new Date(Date.now() - 86400000 * 45).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 45).toISOString()
    }
  ],"""
content = re.sub(r"  conversations: \[.*?  \],", convs_new, content, flags=re.DOTALL)

messages = """  messages: [
    {
      id: 'msg-saas-1',
      conversation_id: 'conv-saas-1',
      role: 'user',
      content: 'Hi, I would like to know more about your enterprise pricing.',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'msg-saas-2',
      conversation_id: 'conv-saas-1',
      role: 'agent',
      content: 'Hello John! I will send you a PDF with our pricing right away. Let me know if you need to schedule a call.',
      created_at: new Date().toISOString()
    },
    {
      id: 'msg-saas-3',
      conversation_id: 'conv-saas-2',
      role: 'user',
      content: 'Can you book a meeting with the sales team for next Tuesday?',
      created_at: new Date(Date.now() - 1800000).toISOString()
    },
    {
      id: 'msg-saas-4',
      conversation_id: 'conv-saas-2',
      role: 'assistant',
      content: 'I would be happy to help with that. What time works best for you on Tuesday?',
      created_at: new Date(Date.now() - 1700000).toISOString()
    },
    {
      id: 'msg-saas-5',
      conversation_id: 'conv-saas-3',
      role: 'system',
      content: 'Trigger activated: New Lead via webhook',
      created_at: new Date(Date.now() - 500000).toISOString()
    },
    {
      id: 'msg-saas-6',
      conversation_id: 'conv-saas-3',
      role: 'assistant',
      content: 'Lead Jane Smith captured. Enriching company data for Innovate LLC... Data enriched successfully. Next step: Send Welcome Email.',
      created_at: new Date(Date.now() - 400000).toISOString()
    }
  ],"""

messages_new = """  messages: [
    {
      id: 'msg-saas-1',
      conversation_id: 'conv-saas-1',
      role: 'user',
      content: 'Hi, I watched the AI in Analytics webinar. Can we schedule a demo for my team at DataTech? We are looking to upgrade from our current BI tool.',
      created_at: new Date(Date.now() - 86400000 * 5 - 3600000).toISOString()
    },
    {
      id: 'msg-saas-2',
      conversation_id: 'conv-saas-1',
      role: 'assistant',
      content: 'Hi Sarah! Absolutely. I see DataTech has been growing rapidly. I can schedule a demo with our Enterprise team. Does next Tuesday at 10 AM PST work for you?',
      created_at: new Date(Date.now() - 86400000 * 5 - 3500000).toISOString()
    },
    {
      id: 'msg-saas-3',
      conversation_id: 'conv-saas-1',
      role: 'user',
      content: 'Yes, Tuesday at 10 AM is perfect. We are primarily interested in the Enterprise plan due to our user count (~150). Could you send over some security compliance docs beforehand?',
      created_at: new Date(Date.now() - 86400000 * 5 - 1800000).toISOString()
    },
    {
      id: 'msg-saas-4',
      conversation_id: 'conv-saas-1',
      role: 'assistant',
      content: 'Demo booked! I will have our team prepare the security compliance documentation and send it to you before the meeting.',
      created_at: new Date(Date.now() - 86400000 * 5 - 1700000).toISOString()
    },
    {
      id: 'msg-saas-5',
      conversation_id: 'conv-saas-3',
      role: 'system',
      content: 'Trigger activated: New Lead via Webinar Webhook',
      created_at: new Date(Date.now() - 86400000 * 45 - 500000).toISOString()
    },
    {
      id: 'msg-saas-6',
      conversation_id: 'conv-saas-3',
      role: 'assistant',
      content: 'Lead Sarah Williams (DataTech) captured. Enriching company data...',
      created_at: new Date(Date.now() - 86400000 * 45 - 400000).toISOString()
    },
    {
      id: 'msg-saas-7',
      conversation_id: 'conv-saas-3',
      role: 'assistant',
      content: 'Data enriched: DataTech has 150 employees. Assigning to Enterprise Leads segment. Next step: Send Webinar Follow-up Email.',
      created_at: new Date(Date.now() - 86400000 * 45 - 300000).toISOString()
    }
  ],"""
content = re.sub(r"  messages: \[.*?  \],", messages_new, content, flags=re.DOTALL)

# Update instance logs
instance_logs = """  instance_logs: [
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
  ]"""

instance_logs_new = """  instance_logs: [
    {
      id: 'log-saas-1',
      log_type: 'system',
      level: 'info',
      message: 'Webhook received new lead data from Webinar: AI in Analytics',
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-1',
      created_at: new Date(Date.now() - 86400000 * 45 - 3600000).toISOString()
    },
    {
      id: 'log-saas-2',
      log_type: 'tool_call',
      level: 'info',
      message: 'Calling clearbit to enrich company data for DataTech',
      tool_name: 'clearbit_enrich',
      tool_args: { domain: 'datatech.io' },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-1',
      created_at: new Date(Date.now() - 86400000 * 45 - 3595000).toISOString()
    },
    {
      id: 'log-saas-3',
      log_type: 'tool_result',
      level: 'info',
      message: 'Company enriched successfully',
      tool_name: 'clearbit_enrich',
      tool_result: { employees: 150, industry: 'technology', revenue: '$5M-10M' },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-1',
      created_at: new Date(Date.now() - 86400000 * 45 - 3590000).toISOString()
    },
    {
      id: 'log-saas-4',
      log_type: 'agent_action',
      level: 'info',
      message: 'Added to Enterprise Leads segment based on employee count > 50',
      details: { segment_id: 'seg-saas-1' },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-1',
      created_at: new Date(Date.now() - 86400000 * 45 - 3585000).toISOString()
    }
  ]"""
content = re.sub(r"  instance_logs: \[.*?  \]", instance_logs_new, content, flags=re.DOTALL)

with open('lib/demo-data/demo-saas-en-123.ts', 'w') as f:
    f.write(content)

