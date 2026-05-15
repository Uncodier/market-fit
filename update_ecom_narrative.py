import json
import re

with open('lib/demo-data/demo-ecom-es-456.ts', 'r') as f:
    content = f.read()

# Update Maria Garcia Lead
maria_lead = """    {
      id: 'lead-ecom-1',
      site_id: 'demo-ecom-es-456',
      name: 'María García',
      email: 'maria.g@ejemplo.com',
      company: '',
      status: 'new',
      created_at: new Date(Date.now() - 86400000 * 1).toISOString()
    },"""

maria_lead_new = """    {
      id: 'lead-ecom-1',
      site_id: 'demo-ecom-es-456',
      name: 'María García',
      email: 'maria.g@modayestilo.com',
      company: 'Moda y Estilo SL',
      status: 'converted',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString()
    },"""

content = content.replace(maria_lead, maria_lead_new)

# Update Carlos Lopez Lead
carlos_lead = """    {
      id: 'lead-ecom-2',
      site_id: 'demo-ecom-es-456',
      name: 'Carlos López',
      email: 'carlos.l@ejemplo.com',
      company: '',
      status: 'converted',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString()
    },"""

carlos_lead_new = """    {
      id: 'lead-ecom-2',
      site_id: 'demo-ecom-es-456',
      name: 'Carlos López',
      email: 'carlos.l@ejemplo.com',
      company: '',
      status: 'converted',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },"""

content = content.replace(carlos_lead, carlos_lead_new)


# Update Boutique Deal connected to Maria
boutique_deal = """    {
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
    },"""

boutique_deal_new = """    {
      id: 'deal-ecom-2',
      name: 'Pedido Inicial Boutique',
      amount: 3500,
      currency: 'EUR',
      stage: 'negotiation',
      status: 'open',
      company_id: 'company-ecom-2',
      site_id: 'demo-ecom-es-456',
      expected_close_date: new Date(Date.now() + 86400000 * 2).toISOString(),
      notes: 'María (dueña de la boutique) solicitó catálogo mayorista por chat. Necesitamos enviarle muestras.',
      qualification_score: 85,
      qualification_criteria: { 'budget': true, 'authority': true, 'need': true, 'timeline': true },
      sales_order_id: null,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString()
    },"""

content = content.replace(boutique_deal, boutique_deal_new)

# Update tasks
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

tasks_ecom_new = """  tasks: [
    {
      id: 'task-ecom-1',
      site_id: 'demo-ecom-es-456',
      title: 'Enviar muestras de tela a María (Moda y Estilo)',
      status: 'pending',
      priority: 'high',
      due_date: new Date(Date.now() + 86400000).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 1).toISOString()
    },
    {
      id: 'task-ecom-2',
      site_id: 'demo-ecom-es-456',
      title: 'Actualizar catálogo de invierno en Shopify',
      status: 'in_progress',
      priority: 'normal',
      due_date: new Date(Date.now() + 86400000 * 3).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'task-ecom-3',
      site_id: 'demo-ecom-es-456',
      title: 'Revisar métricas de carrito abandonado',
      status: 'completed',
      priority: 'normal',
      due_date: new Date(Date.now() - 86400000 * 2).toISOString(),
      created_at: new Date(Date.now() - 86400000 * 5).toISOString()
    }
  ],"""

content = re.sub(r"  tasks: \[.*?  \],", tasks_ecom_new, content, flags=re.DOTALL)

# Update Conversations
convs = """  conversations: [
    {
      id: 'conv-ecom-1',
      site_id: 'demo-ecom-es-456',
      lead_id: 'lead-ecom-1',
      status: 'active',
      channel: 'whatsapp',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'conv-ecom-2',
      site_id: 'demo-ecom-es-456',
      agent_id: 'agent-ecom-1',
      title: 'Chat with Asistente de Compras',
      status: 'active',
      channel: 'web',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'conv-ecom-3',
      site_id: 'demo-ecom-es-456',
      command_id: 'node-ecom-1',
      title: 'Node Execution Log',
      status: 'active',
      channel: 'web',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],"""

convs_new = """  conversations: [
    {
      id: 'conv-ecom-1',
      site_id: 'demo-ecom-es-456',
      lead_id: 'lead-ecom-1',
      agent_id: 'agent-ecom-1',
      title: 'Chat Mayorista: María García',
      status: 'active',
      channel: 'web',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date(Date.now() - 86400000 * 5).toISOString()
    },
    {
      id: 'conv-ecom-2',
      site_id: 'demo-ecom-es-456',
      lead_id: 'lead-ecom-2',
      agent_id: 'agent-ecom-2',
      title: 'Chat Recuperación de Carrito: Carlos López',
      status: 'active',
      channel: 'whatsapp',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'conv-ecom-3',
      site_id: 'demo-ecom-es-456',
      command_id: 'node-ecom-1',
      title: 'Ejecución Nodo: Carrito Abandonado',
      status: 'active',
      channel: 'web',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString()
    }
  ],"""

content = re.sub(r"  conversations: \[.*?  \],", convs_new, content, flags=re.DOTALL)

# Update Messages
messages = """  messages: [
    {
      id: 'msg-ecom-1',
      conversation_id: 'conv-ecom-1',
      role: 'user',
      content: '¡Hola! ¿Tienen stock de la camiseta azul en talla M?',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'msg-ecom-2',
      conversation_id: 'conv-ecom-1',
      role: 'agent',
      content: '¡Hola María! Sí, nos quedan las últimas unidades. Puedes hacer el pedido desde este link directo.',
      created_at: new Date().toISOString()
    },
    {
      id: 'msg-ecom-3',
      conversation_id: 'conv-ecom-2',
      role: 'user',
      content: 'Quiero buscar unos pantalones de lino para mujer.',
      created_at: new Date(Date.now() - 1800000).toISOString()
    },
    {
      id: 'msg-ecom-4',
      conversation_id: 'conv-ecom-2',
      role: 'assistant',
      content: '¡Claro! Tengo varias opciones de pantalones de lino. ¿Buscas algún color en específico?',
      created_at: new Date(Date.now() - 1700000).toISOString()
    },
    {
      id: 'msg-ecom-5',
      conversation_id: 'conv-ecom-3',
      role: 'system',
      content: 'Iniciando ejecución de nodo: Carrito Abandonado',
      created_at: new Date(Date.now() - 500000).toISOString()
    },
    {
      id: 'msg-ecom-6',
      conversation_id: 'conv-ecom-3',
      role: 'assistant',
      content: 'Analizando datos del carrito de compra... 3 productos encontrados. Preparando mensaje de recuperación.',
      created_at: new Date(Date.now() - 400000).toISOString()
    }
  ],"""

messages_new = """  messages: [
    {
      id: 'msg-ecom-1',
      conversation_id: 'conv-ecom-1',
      role: 'user',
      content: '¡Hola! Soy dueña de una boutique y me gustaría ver su catálogo mayorista para la nueva colección de verano.',
      created_at: new Date(Date.now() - 86400000 * 5 - 3600000).toISOString()
    },
    {
      id: 'msg-ecom-2',
      conversation_id: 'conv-ecom-1',
      role: 'assistant',
      content: '¡Hola María! Qué gusto saludarte. Claro que sí, manejamos ventas B2B. Te acabo de enviar un enlace a nuestro catálogo mayorista. ¿Te gustaría que te enviemos algunas muestras físicas?',
      created_at: new Date(Date.now() - 86400000 * 5 - 3500000).toISOString()
    },
    {
      id: 'msg-ecom-3',
      conversation_id: 'conv-ecom-1',
      role: 'user',
      content: '¡Sí, por favor! Sería ideal para revisar la calidad de las telas antes de hacer el pedido inicial.',
      created_at: new Date(Date.now() - 86400000 * 5 - 1800000).toISOString()
    },
    {
      id: 'msg-ecom-4',
      conversation_id: 'conv-ecom-1',
      role: 'assistant',
      content: 'Perfecto, he creado una tarea para que nuestro equipo te envíe las muestras. Un ejecutivo se pondrá en contacto contigo pronto.',
      created_at: new Date(Date.now() - 86400000 * 5 - 1700000).toISOString()
    },
    {
      id: 'msg-ecom-5',
      conversation_id: 'conv-ecom-2',
      role: 'agent',
      content: '¡Hola Carlos! Vimos que dejaste algunos artículos en tu carrito. Usa el código VOLVISTE10 para un 10% de descuento si terminas tu compra hoy: https://moda-rapida.demo/checkout/123',
      created_at: new Date(Date.now() - 3500000).toISOString()
    },
    {
      id: 'msg-ecom-6',
      conversation_id: 'conv-ecom-2',
      role: 'user',
      content: '¡Gracias! Acabo de hacer el pedido.',
      created_at: new Date(Date.now() - 3000000).toISOString()
    },
    {
      id: 'msg-ecom-7',
      conversation_id: 'conv-ecom-3',
      role: 'system',
      content: 'Iniciando ejecución de nodo: Carrito Abandonado (Trigger: Shopify)',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'msg-ecom-8',
      conversation_id: 'conv-ecom-3',
      role: 'assistant',
      content: 'Detectado carrito abandonado de Carlos López. Esperando 2 horas según configuración del flujo.',
      created_at: new Date(Date.now() - 3550000).toISOString()
    },
    {
      id: 'msg-ecom-9',
      conversation_id: 'conv-ecom-3',
      role: 'assistant',
      content: 'Tiempo de espera completado. El usuario no ha completado la compra. Ejecutando acción: Enviar WhatsApp de Descuento (Template: abandoned_cart_10).',
      created_at: new Date(Date.now() - 3500000).toISOString()
    }
  ],"""

content = re.sub(r"  messages: \[.*?  \],", messages_new, content, flags=re.DOTALL)

# Update instance logs
instance_logs = """  instance_logs: [
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
  ]"""

instance_logs_new = """  instance_logs: [
    {
      id: 'log-ecom-1',
      log_type: 'system',
      level: 'info',
      message: 'Trigger Shopify: Carrito Abandonado detectado para Carlos López',
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
      message: 'Evaluando condiciones del flujo. Esperando 2 horas.',
      details: { cart_id: 'cart_carlos_123', value: '120.50 EUR' },
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-1',
      created_at: new Date(Date.now() - 3550000).toISOString()
    },
    {
      id: 'log-ecom-3',
      log_type: 'tool_call',
      level: 'info',
      message: 'Llamando a la API de WhatsApp para enviar plantilla de descuento',
      tool_name: 'send_whatsapp_template',
      tool_args: { template: 'abandoned_cart_10', phone: '+34600000000' },
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-1',
      created_at: new Date(Date.now() - 3500000).toISOString()
    },
    {
      id: 'log-ecom-4',
      log_type: 'tool_result',
      level: 'info',
      message: 'Mensaje de WhatsApp enviado correctamente',
      tool_name: 'send_whatsapp_template',
      tool_result: { message_id: 'wamid.HBgL...', status: 'sent' },
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-1',
      created_at: new Date(Date.now() - 3495000).toISOString()
    }
  ]"""

content = re.sub(r"  instance_logs: \[.*?  \]", instance_logs_new, content, flags=re.DOTALL)

with open('lib/demo-data/demo-ecom-es-456.ts', 'w') as f:
    f.write(content)

