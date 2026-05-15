import json
import re

with open('lib/demo-data/demo-saas-en-123.ts', 'r') as f:
    content = f.read()

# Let's replace the commands array and instance_logs array for saas

commands_new = """  commands: [
    {
      id: 'cmd-saas-1',
      uuid: 'cmd-saas-1',
      task: 'Process new enterprise lead',
      status: 'completed',
      user_id: 'demo-user-123',
      description: 'Webhook triggered pipeline',
      created_at: new Date(Date.now() - 86400000 * 45 - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 45 - 3500000).toISOString()
    },
    {
      id: 'cmd-saas-2',
      uuid: 'cmd-saas-2',
      task: 'Scrape competitor pricing (HubSpot & Salesforce)',
      status: 'completed',
      user_id: 'demo-user-123',
      agent_id: 'agent-saas-1',
      description: 'Weekly competitor pricing analysis via Scrapybara browser agent',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],"""

content = re.sub(r"  commands: \[.*?  \],", commands_new, content, flags=re.DOTALL)

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
      duration_ms: 1250,
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
    },
    
    // NEW COMMAND LOGS: Competitor pricing scraping via Scrapybara browser agent
    {
      id: 'log-saas-5',
      log_type: 'system',
      level: 'info',
      message: 'Starting Scrapybara browser session for competitor pricing analysis',
      details: { os: 'ubuntu', browser: 'chromium', resolution: '1920x1080' },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-2',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'log-saas-6',
      log_type: 'agent_action',
      level: 'info',
      message: 'Planning execution steps',
      details: { 
        steps: [
          "Navigate to HubSpot pricing page",
          "Extract Sales Hub Enterprise pricing",
          "Navigate to Salesforce pricing page",
          "Extract Sales Cloud Enterprise pricing",
          "Compile report and save as artifact"
        ]
      },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-2',
      created_at: new Date(Date.now() - 3590000).toISOString()
    },
    {
      id: 'log-saas-7',
      log_type: 'tool_call',
      level: 'info',
      message: 'Navigating to URL',
      tool_name: 'browser_goto',
      tool_args: { url: 'https://www.hubspot.com/pricing/sales' },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-2',
      created_at: new Date(Date.now() - 3580000).toISOString()
    },
    {
      id: 'log-saas-8',
      log_type: 'tool_result',
      level: 'info',
      message: 'Page loaded successfully',
      tool_name: 'browser_goto',
      tool_result: { status: 200, title: 'HubSpot Sales Hub Pricing' },
      duration_ms: 3200,
      tokens_used: { prompt: 150, completion: 45 },
      screenshot_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-2',
      created_at: new Date(Date.now() - 3570000).toISOString()
    },
    {
      id: 'log-saas-9',
      log_type: 'tool_call',
      level: 'info',
      message: 'Clicking on Enterprise tab',
      tool_name: 'browser_click',
      tool_args: { selector: 'button[data-test-id="enterprise-tab"]', x: 450, y: 320 },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-2',
      created_at: new Date(Date.now() - 3560000).toISOString()
    },
    {
      id: 'log-saas-10',
      log_type: 'tool_result',
      level: 'info',
      message: 'Click successful, content updated',
      tool_name: 'browser_click',
      tool_result: { success: True },
      duration_ms: 850,
      tokens_used: { prompt: 450, completion: 20 },
      screenshot_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-2',
      created_at: new Date(Date.now() - 3550000).toISOString()
    },
    {
      id: 'log-saas-11',
      log_type: 'tool_call',
      level: 'info',
      message: 'Extracting pricing data',
      tool_name: 'browser_extract',
      tool_args: { instruction: 'Get the monthly price for the Enterprise tier and included seats' },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-2',
      created_at: new Date(Date.now() - 3540000).toISOString()
    },
    {
      id: 'log-saas-12',
      log_type: 'tool_result',
      level: 'info',
      message: 'Data extracted',
      tool_name: 'browser_extract',
      tool_result: { price: '$150/mo', seats: '10 included', billing: 'billed annually' },
      duration_ms: 4500,
      tokens_used: { prompt: 1200, completion: 150 },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-2',
      created_at: new Date(Date.now() - 3530000).toISOString()
    },
    {
      id: 'log-saas-13',
      log_type: 'agent_action',
      level: 'info',
      message: 'Analyzing extracted data and generating report artifact',
      details: { 
        competitor: 'HubSpot',
        tier: 'Enterprise',
        price_per_seat_est: '$15/mo'
      },
      artifacts: [
        { name: 'competitor_pricing_hubspot.json', type: 'application/json', size: 128 }
      ],
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-2',
      created_at: new Date(Date.now() - 3520000).toISOString()
    },
    {
      id: 'log-saas-14',
      log_type: 'system',
      level: 'info',
      message: 'Task completed successfully',
      details: { total_duration_ms: 80000, total_tokens: 3450 },
      instance_id: 'remote-saas-1',
      site_id: 'demo-saas-en-123',
      user_id: 'demo-user-123',
      command_id: 'cmd-saas-2',
      created_at: new Date(Date.now() - 3510000).toISOString()
    }
  ]"""

content = re.sub(r"  instance_logs: \[.*?  \]", instance_logs_new, content, flags=re.DOTALL)

with open('lib/demo-data/demo-saas-en-123.ts', 'w') as f:
    f.write(content)

