import json
import re

# ECOM EXTRAS
with open('lib/demo-data/demo-ecom-es-456.ts', 'r') as f:
    content = f.read()

tasks_ecom = """  tasks: [
    {
      id: 'task-ecom-1',
      site_id: 'demo-ecom-es-456',
      title: 'Actualizar catálogo de invierno',
      status: 'in_progress',
      priority: 'normal',
      due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
      created_at: new Date().toISOString()
    },
    {
      id: 'task-ecom-2',
      site_id: 'demo-ecom-es-456',
      title: 'Revisar fotos de nueva colección',
      status: 'pending',
      priority: 'high',
      due_date: new Date(Date.now() + 86400000 * 1).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'task-ecom-3',
      site_id: 'demo-ecom-es-456',
      title: 'Contactar proveedores para rebajas',
      status: 'completed',
      priority: 'normal',
      due_date: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 5).toISOString()
    }
  ],"""
content = re.sub(r"  tasks: \[.*?  \],", tasks_ecom, content, flags=re.DOTALL)

campaigns_ecom = """  campaigns: [
    {
      id: 'camp-ecom-1',
      site_id: 'demo-ecom-es-456',
      title: 'Rebajas de Verano',
      description: 'Campaña de descuentos de temporada en redes',
      priority: 'high',
      type: 'performance',
      status: 'active',
      budget: { allocated: 2000, remaining: 500, currency: 'EUR' },
      revenue: { actual: 4500, projected: 6000, estimated: 5500, currency: 'EUR' },
      assignees: 2,
      issues: 0,
      due_date: new Date(Date.now() + 86400000 * 15).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'camp-ecom-2',
      site_id: 'demo-ecom-es-456',
      title: 'Lanzamiento Colección Otoño',
      description: 'Pre-venta exclusiva para clientes recurrentes',
      priority: 'medium',
      type: 'outbound',
      status: 'pending',
      budget: { allocated: 1500, remaining: 1500, currency: 'EUR' },
      revenue: { actual: 0, projected: 8000, estimated: 6000, currency: 'EUR' },
      assignees: 1,
      issues: 1,
      due_date: new Date(Date.now() + 86400000 * 45).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'camp-ecom-3',
      site_id: 'demo-ecom-es-456',
      title: 'Día de la Madre',
      description: 'Promoción especial del día de la madre',
      priority: 'high',
      type: 'performance',
      status: 'completed',
      budget: { allocated: 3000, remaining: 120, currency: 'EUR' },
      revenue: { actual: 9500, projected: 8000, estimated: 8000, currency: 'EUR' },
      assignees: 3,
      issues: 0,
      due_date: new Date(Date.now() - 86400000 * 10).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 40).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString()
    }
  ],"""
content = re.sub(r"  campaigns: \[.*?  \],", campaigns_ecom, content, flags=re.DOTALL)

with open('lib/demo-data/demo-ecom-es-456.ts', 'w') as f:
    f.write(content)


# SAAS EXTRAS
with open('lib/demo-data/demo-saas-en-123.ts', 'r') as f:
    content = f.read()

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
content = re.sub(r"  tasks: \[.*?  \],", tasks_saas, content, flags=re.DOTALL)

campaigns_saas = """  campaigns: [
    {
      id: 'camp-saas-1',
      site_id: 'demo-saas-en-123',
      title: 'Q3 Enterprise Outreach',
      description: 'Outbound campaign targeting enterprise clients in North America',
      priority: 'high',
      type: 'outbound',
      status: 'active',
      budget: { allocated: 5000, remaining: 3800, currency: 'USD' },
      revenue: { actual: 12000, projected: 25000, estimated: 30000, currency: 'USD' },
      assignees: 2,
      issues: 0,
      due_date: new Date(Date.now() + 86400000 * 30).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'camp-saas-2',
      site_id: 'demo-saas-en-123',
      title: 'Webinar: AI in Analytics',
      description: 'Lead generation webinar focusing on AI capabilities',
      priority: 'medium',
      type: 'inbound',
      status: 'pending',
      budget: { allocated: 1500, remaining: 1500, currency: 'USD' },
      revenue: { actual: 0, projected: 10000, estimated: 8000, currency: 'USD' },
      assignees: 3,
      issues: 0,
      due_date: new Date(Date.now() + 86400000 * 14).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'camp-saas-3',
      site_id: 'demo-saas-en-123',
      title: 'Customer Success Retargeting',
      description: 'Upsell campaign for existing mid-market clients',
      priority: 'low',
      type: 'account',
      status: 'active',
      budget: { allocated: 2000, remaining: 800, currency: 'USD' },
      revenue: { actual: 8500, projected: 15000, estimated: 12000, currency: 'USD' },
      assignees: 1,
      issues: 2,
      due_date: new Date(Date.now() + 86400000 * 45).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],"""
content = re.sub(r"  campaigns: \[.*?  \],", campaigns_saas, content, flags=re.DOTALL)

with open('lib/demo-data/demo-saas-en-123.ts', 'w') as f:
    f.write(content)

