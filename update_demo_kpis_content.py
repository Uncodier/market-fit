import json
import re

# ECOM EXTRAS
with open('lib/demo-data/demo-ecom-es-456.ts', 'r') as f:
    content = f.read()

content_ecom = """  content: [
    {
      id: 'content-ecom-1',
      site_id: 'demo-ecom-es-456',
      title: 'Tendencias de Verano 2026',
      description: 'Guía completa sobre qué usar esta temporada',
      type: 'blog_post',
      status: 'published',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'content-ecom-2',
      site_id: 'demo-ecom-es-456',
      title: 'Reel: Look de fin de semana',
      description: 'Video corto para Instagram',
      type: 'social_post',
      status: 'review',
      created_at: new Date().toISOString()
    },
    {
      id: 'content-ecom-3',
      site_id: 'demo-ecom-es-456',
      title: 'Newsletter Rebajas Especiales',
      description: 'Campaña de email para clientes VIP',
      type: 'newsletter',
      status: 'draft',
      created_at: new Date().toISOString()
    }
  ],"""
content = re.sub(r"  content: \[.*?  \],", content_ecom, content, flags=re.DOTALL)

kpis_ecom = """  kpis: [
    {
      id: 'kpi-ecom-1',
      site_id: 'demo-ecom-es-456',
      name: 'Ventas Diarias',
      value: 3450,
      previous_value: 3100,
      unit: 'EUR',
      type: 'revenue',
      period_start: new Date(Date.now() - 86400000 * 1).toISOString(),
      period_end: new Date().toISOString(),
      trend: 11.2,
      created_at: new Date().toISOString()
    },
    {
      id: 'kpi-ecom-2',
      site_id: 'demo-ecom-es-456',
      name: 'Tasa de Conversión',
      value: 2.8,
      previous_value: 2.4,
      unit: 'percentage',
      type: 'conversion',
      period_start: new Date(Date.now() - 86400000 * 7).toISOString(),
      period_end: new Date().toISOString(),
      trend: 16.6,
      created_at: new Date().toISOString()
    },
    {
      id: 'kpi-ecom-3',
      site_id: 'demo-ecom-es-456',
      name: 'Costo por Adquisición',
      value: 12.5,
      previous_value: 15.0,
      unit: 'EUR',
      type: 'acquisition',
      period_start: new Date(Date.now() - 86400000 * 30).toISOString(),
      period_end: new Date().toISOString(),
      trend: -16.6,
      created_at: new Date().toISOString()
    }
  ],"""
content = re.sub(r"  kpis: \[.*?  \],", kpis_ecom, content, flags=re.DOTALL)

with open('lib/demo-data/demo-ecom-es-456.ts', 'w') as f:
    f.write(content)


# SAAS EXTRAS
with open('lib/demo-data/demo-saas-en-123.ts', 'r') as f:
    content = f.read()

content_saas = """  content: [
    {
      id: 'content-saas-1',
      site_id: 'demo-saas-en-123',
      title: 'The Future of SaaS',
      description: 'A deep dive into upcoming enterprise SaaS trends.',
      type: 'blog_post',
      status: 'published',
      created_at: new Date(Date.now() - 86400000 * 7).toISOString()
    },
    {
      id: 'content-saas-2',
      site_id: 'demo-saas-en-123',
      title: 'Acme Product Demo Video',
      description: 'Quick walkthrough of Acme features',
      type: 'video',
      status: 'approved',
      created_at: new Date().toISOString()
    },
    {
      id: 'content-saas-3',
      site_id: 'demo-saas-en-123',
      title: 'Case Study: Cloud Systems',
      description: 'How Cloud Systems reduced costs by 40%',
      type: 'case_study',
      status: 'draft',
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    }
  ],"""
content = re.sub(r"  content: \[.*?  \],", content_saas, content, flags=re.DOTALL)

kpis_saas = """  kpis: [
    {
      id: 'kpi-saas-1',
      site_id: 'demo-saas-en-123',
      name: 'Monthly Recurring Revenue',
      value: 12500,
      previous_value: 10000,
      unit: 'USD',
      type: 'revenue',
      period_start: new Date(Date.now() - 86400000 * 30).toISOString(),
      period_end: new Date().toISOString(),
      trend: 25,
      created_at: new Date().toISOString()
    },
    {
      id: 'kpi-saas-2',
      site_id: 'demo-saas-en-123',
      name: 'Customer Acquisition Cost',
      value: 850,
      previous_value: 920,
      unit: 'USD',
      type: 'acquisition',
      period_start: new Date(Date.now() - 86400000 * 30).toISOString(),
      period_end: new Date().toISOString(),
      trend: -7.6,
      created_at: new Date().toISOString()
    },
    {
      id: 'kpi-saas-3',
      site_id: 'demo-saas-en-123',
      name: 'Net Retention Rate',
      value: 112,
      previous_value: 108,
      unit: 'percentage',
      type: 'retention',
      period_start: new Date(Date.now() - 86400000 * 90).toISOString(),
      period_end: new Date().toISOString(),
      trend: 3.7,
      created_at: new Date().toISOString()
    }
  ],"""
content = re.sub(r"  kpis: \[.*?  \],", kpis_saas, content, flags=re.DOTALL)

with open('lib/demo-data/demo-saas-en-123.ts', 'w') as f:
    f.write(content)

