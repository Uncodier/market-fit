import json
import re

with open('lib/demo-data/demo-ecom-es-456.ts', 'r') as f:
    content = f.read()

# Add instance_logs and commands at the end of the object
if 'instance_logs:' not in content:
    content = content.replace('};', """,
  commands: [
    {
      id: 'cmd-ecom-1',
      uuid: 'cmd-ecom-1',
      task: 'Analizar carritos abandonados',
      status: 'completed',
      user_id: 'demo-user-456',
      description: 'Revisión periódica de carritos',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3500000).toISOString()
    }
  ],
  instance_logs: [
    {
      id: 'log-ecom-1',
      log_type: 'system',
      level: 'info',
      message: 'Iniciando análisis de carritos abandonados',
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-1',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'log-ecom-2',
      log_type: 'agent_action',
      level: 'info',
      message: 'Se encontraron 3 carritos abandonados en la última hora',
      details: { cart_ids: ['cart_1', 'cart_2', 'cart_3'] },
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-1',
      created_at: new Date(Date.now() - 3590000).toISOString()
    },
    {
      id: 'log-ecom-3',
      log_type: 'system',
      level: 'info',
      message: 'Mensajes de recuperación enviados correctamente',
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-1',
      created_at: new Date(Date.now() - 3580000).toISOString()
    }
  ]
};""")

# Add more leads
leads_replacement = """  leads: [
    {
      id: 'lead-ecom-1',
      site_id: 'demo-ecom-es-456',
      name: 'María García',
      email: 'maria.g@ejemplo.com',
      company: '',
      status: 'new',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
      id: 'lead-ecom-2',
      site_id: 'demo-ecom-es-456',
      name: 'Carlos López',
      email: 'carlos.l@ejemplo.com',
      company: '',
      status: 'converted',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
      id: 'lead-ecom-3',
      site_id: 'demo-ecom-es-456',
      name: 'Ana Martínez',
      email: 'ana.m@ejemplo.com',
      company: '',
      status: 'contacted',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'lead-ecom-4',
      site_id: 'demo-ecom-es-456',
      name: 'Pedro Sánchez',
      email: 'pedro.s@ejemplo.com',
      company: '',
      status: 'qualified',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: 'lead-ecom-5',
      site_id: 'demo-ecom-es-456',
      name: 'Laura Gómez',
      email: 'laura.g@ejemplo.com',
      company: '',
      status: 'lost',
      created_at: new Date(Date.now() - 86400000 * 10).toISOString()
    },
    {
      id: 'lead-ecom-6',
      site_id: 'demo-ecom-es-456',
      name: 'Javier Rodríguez',
      email: 'javier.r@ejemplo.com',
      company: '',
      status: 'new',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString()
    }
  ],"""
content = re.sub(r"  leads: \[.*?  \],", leads_replacement, content, flags=re.DOTALL)

# Add more companies
companies_replacement = """  companies: [
    {
      id: 'company-ecom-1',
      name: 'Retail Group SA',
      industry: 'retail',
      size: '11-50',
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'company-ecom-2',
      name: 'Moda y Estilo SL',
      industry: 'fashion',
      size: '1-10',
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'company-ecom-3',
      name: 'Distribuidores Centro',
      industry: 'wholesale',
      size: '51-200',
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],"""
content = re.sub(r"  companies: \[.*?  \],", companies_replacement, content, flags=re.DOTALL)

# Add more deals
deals_replacement = """  deals: [
    {
      id: 'deal-ecom-1',
      name: 'Venta Mayorista Colección Verano',
      amount: 15000,
      currency: 'EUR',
      stage: 'negotiation',
      status: 'open',
      company_id: 'company-ecom-1',
      site_id: 'demo-ecom-es-456',
      expected_close_date: new Date(Date.now() + 86400000 * 7).toISOString(),
      notes: 'El cliente está interesado en la colección completa',
      qualification_score: 85,
      qualification_criteria: { 'budget': true, 'authority': true, 'need': true, 'timeline': true },
      sales_order_id: null,
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'deal-ecom-2',
      name: 'Pedido Inicial Boutique',
      amount: 3500,
      currency: 'EUR',
      stage: 'proposal',
      status: 'open',
      company_id: 'company-ecom-2',
      site_id: 'demo-ecom-es-456',
      expected_close_date: new Date(Date.now() + 86400000 * 14).toISOString(),
      notes: 'Boutique nueva en el centro',
      qualification_score: 70,
      qualification_criteria: { 'budget': true, 'authority': false, 'need': true, 'timeline': true },
      sales_order_id: null,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'deal-ecom-3',
      name: 'Renovación Contrato Anual',
      amount: 25000,
      currency: 'EUR',
      stage: 'closed_won',
      status: 'won',
      company_id: 'company-ecom-3',
      site_id: 'demo-ecom-es-456',
      expected_close_date: new Date(Date.now() - 86400000 * 2).toISOString(),
      notes: 'Cliente muy satisfecho con ventas anteriores',
      qualification_score: 95,
      qualification_criteria: { 'budget': true, 'authority': true, 'need': true, 'timeline': true },
      sales_order_id: null,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'deal-ecom-4',
      name: 'Campaña Accesorios Otoño',
      amount: 8000,
      currency: 'EUR',
      stage: 'closed_lost',
      status: 'lost',
      company_id: 'company-ecom-1',
      site_id: 'demo-ecom-es-456',
      expected_close_date: new Date(Date.now() - 86400000 * 5).toISOString(),
      notes: 'Presupuesto asignado a otra marca',
      qualification_score: 40,
      qualification_criteria: { 'budget': false, 'authority': true, 'need': false, 'timeline': true },
      sales_order_id: null,
      created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString()
    }
  ],"""
content = re.sub(r"  deals: \[.*?  \],", deals_replacement, content, flags=re.DOTALL)

with open('lib/demo-data/demo-ecom-es-456.ts', 'w') as f:
    f.write(content)
