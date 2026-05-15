import json
import re

with open('lib/demo-data/demo-ecom-es-456.ts', 'r') as f:
    content = f.read()

# ECOM AGENTS
agents_ecom = """  agents: [
    {
      id: 'agent-ecom-1',
      site_id: 'demo-ecom-es-456',
      name: 'Asistente de Compras',
      description: 'Asistente B2B y B2C que ayuda con el catálogo, inventario y proceso de checkout',
      type: 'sales',
      status: 'active',
      prompt: 'Eres el Asistente de Compras de Moda Rápida. Tu objetivo es ayudar a los clientes mayoristas (B2B) ofreciendo envío de muestras físicas, y a los clientes D2C con tallas, colores y finalización de la compra. Sé amable, proactivo y cierra ventas.',
      conversations: 145,
      success_rate: 68.5,
      configuration: { temperature: 0.7, model: 'gpt-4o' },
      role: 'Sales Representative',
      tools: ['search_catalog', 'check_inventory', 'create_task'],
      activities: ['Respondió a María García sobre el catálogo B2B', 'Agendó envío de muestras físicas'],
      integrations: ['shopify', 'whatsapp', 'crm'],
      user_id: 'demo-user-456',
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date().toISOString(),
      last_active: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'agent-ecom-2',
      site_id: 'demo-ecom-es-456',
      name: 'Recuperador de Carritos',
      description: 'Agente que se encarga de reenganchar a los clientes con carritos abandonados',
      type: 'marketing',
      status: 'active',
      prompt: 'Eres un agente especializado en recuperación de carritos. Evalúa el valor del carrito y si es mayor a 50 EUR, envía un descuento del 10% para motivar el checkout.',
      conversations: 320,
      success_rate: 22.4,
      configuration: { temperature: 0.5, model: 'gpt-4o-mini' },
      role: 'Marketing Automation',
      tools: ['send_whatsapp_template', 'generate_discount_code'],
      activities: ['Envió cupón VOLVISTE10 a Carlos López', 'Recuperó carrito de 120.50 EUR'],
      integrations: ['shopify', 'whatsapp'],
      user_id: 'demo-user-456',
      created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
      updated_at: new Date().toISOString(),
      last_active: new Date(Date.now() - 3500000).toISOString()
    }
  ],"""
content = re.sub(r"  agents: \[.*?  \],", agents_ecom, content, flags=re.DOTALL)

# ECOM NODES
nodes_ecom = """  instance_nodes: [
    {
      id: 'node-ecom-1',
      site_id: 'demo-ecom-es-456',
      instance_id: 'remote-ecom-1',
      user_id: 'demo-user-456',
      type: 'trigger',
      title: 'Carrito Abandonado',
      prompt: { text: 'Disparar flujo cuando un checkout en Shopify quede inactivo por más de 1 hora' },
      settings: { source: 'shopify', wait_time_hours: 2, min_value: 50 },
      result: { trigger_activated: true, customer: 'Carlos López', cart_value: 120.5 },
      status: 'completed',
      position_x: 100,
      position_y: 100,
      width: 280,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-ecom-2',
      site_id: 'demo-ecom-es-456',
      instance_id: 'remote-ecom-1',
      user_id: 'demo-user-456',
      type: 'action',
      title: 'Enviar WhatsApp de Descuento',
      prompt: { text: 'Si el cliente aplica, generar código de descuento 10% y enviar plantilla de recuperación vía WhatsApp' },
      settings: { template: 'abandoned_cart_10', discount_amount: 10, discount_type: 'percentage' },
      result: { message_sent: true, to: '+34600000000', template_used: 'abandoned_cart_10', conversion_success: true },
      status: 'completed',
      position_x: 450,
      position_y: 100,
      width: 280,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],"""
content = re.sub(r"  instance_nodes: \[.*?  \],", nodes_ecom, content, flags=re.DOTALL)

with open('lib/demo-data/demo-ecom-es-456.ts', 'w') as f:
    f.write(content)

