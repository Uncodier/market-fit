import re

with open('lib/demo-data/demo-ecom-es-456.ts', 'r') as f:
    content = f.read()

nodes_ecom_new = """  instance_nodes: [
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
      title: 'Generar Cupón Descuento',
      prompt: { text: 'Generar código de descuento del 10% válido por 24 horas' },
      settings: { discount_amount: 10, discount_type: 'percentage', valid_hours: 24 },
      result: { code_generated: 'VOLVISTE10', valid_until: new Date(Date.now() + 86400000).toISOString() },
      status: 'completed',
      position_x: 450,
      position_y: 100,
      width: 280,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-ecom-3',
      site_id: 'demo-ecom-es-456',
      instance_id: 'remote-ecom-1',
      user_id: 'demo-user-456',
      type: 'action',
      title: 'Enviar WhatsApp',
      prompt: { text: 'Enviar plantilla de recuperación vía WhatsApp con el código de descuento' },
      settings: { template: 'abandoned_cart_10' },
      result: { message_sent: true, to: '+34600000000', template_used: 'abandoned_cart_10', conversion_success: true },
      status: 'completed',
      position_x: 800,
      position_y: 100,
      width: 280,
      created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  instance_node_contexts: [
    {
      id: 'edge-ecom-1',
      source_node_id: 'node-ecom-1',
      target_node_id: 'node-ecom-2',
      label: 'Valor > 50 EUR'
    },
    {
      id: 'edge-ecom-2',
      source_node_id: 'node-ecom-2',
      target_node_id: 'node-ecom-3',
      label: 'Cupón generado'
    }
  ],"""

content = re.sub(r"  instance_nodes: \[.*?  \],\s*instance_node_contexts: \[.*?  \],", nodes_ecom_new, content, flags=re.DOTALL)

with open('lib/demo-data/demo-ecom-es-456.ts', 'w') as f:
    f.write(content)

