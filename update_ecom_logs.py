import json
import re

with open('lib/demo-data/demo-ecom-es-456.ts', 'r') as f:
    content = f.read()

commands_new = """  commands: [
    {
      id: 'cmd-ecom-1',
      uuid: 'cmd-ecom-1',
      task: 'Analizar carritos abandonados',
      status: 'completed',
      user_id: 'demo-user-456',
      description: 'Revisión periódica de carritos',
      created_at: new Date(Date.now() - 3600000).toISOString(),
      updated_at: new Date(Date.now() - 3500000).toISOString()
    },
    {
      id: 'cmd-ecom-2',
      uuid: 'cmd-ecom-2',
      task: 'Monitorizar tendencias en Zara y H&M',
      status: 'completed',
      user_id: 'demo-user-456',
      agent_id: 'agent-ecom-1',
      description: 'Análisis de competencia vía Scrapybara (Browser Automation)',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 7100000).toISOString()
    }
  ],"""

content = re.sub(r"  commands: \[.*?  \],", commands_new, content, flags=re.DOTALL)

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
    },
    
    // NEW COMMAND LOGS: Competitor analysis via Scrapybara
    {
      id: 'log-ecom-5',
      log_type: 'system',
      level: 'info',
      message: 'Iniciando sesión de navegador automatizado (Scrapybara)',
      details: { os: 'ubuntu', browser: 'chromium', viewport: '1440x900' },
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-2',
      created_at: new Date(Date.now() - 7200000).toISOString()
    },
    {
      id: 'log-ecom-6',
      log_type: 'tool_call',
      level: 'info',
      message: 'Navegando a sección de novedades (Zara)',
      tool_name: 'browser_goto',
      tool_args: { url: 'https://www.zara.com/es/es/mujer-nuevo-l1180.html' },
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-2',
      created_at: new Date(Date.now() - 7190000).toISOString()
    },
    {
      id: 'log-ecom-7',
      log_type: 'tool_result',
      level: 'info',
      message: 'Página cargada correctamente',
      tool_name: 'browser_goto',
      tool_result: { status: 200, title: 'Novedades Mujer | ZARA España' },
      duration_ms: 4500,
      tokens_used: { prompt: 180, completion: 25 },
      screenshot_base64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-2',
      created_at: new Date(Date.now() - 7180000).toISOString()
    },
    {
      id: 'log-ecom-8',
      log_type: 'tool_call',
      level: 'info',
      message: 'Desplazando la página para cargar imágenes (Lazy Load)',
      tool_name: 'browser_scroll',
      tool_args: { direction: 'down', amount: 1500 },
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-2',
      created_at: new Date(Date.now() - 7170000).toISOString()
    },
    {
      id: 'log-ecom-9',
      log_type: 'tool_call',
      level: 'info',
      message: 'Extrayendo datos de productos y precios',
      tool_name: 'browser_extract',
      tool_args: { instruction: 'Extraer nombre, precio y colores de los primeros 10 artículos' },
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-2',
      created_at: new Date(Date.now() - 7150000).toISOString()
    },
    {
      id: 'log-ecom-10',
      log_type: 'tool_result',
      level: 'info',
      message: 'Extracción completada',
      tool_name: 'browser_extract',
      tool_result: { items_found: 10, average_price: '35.95 EUR', dominant_colors: ['Lino natural', 'Blanco', 'Negro'] },
      duration_ms: 8500,
      tokens_used: { prompt: 2100, completion: 450 },
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-2',
      created_at: new Date(Date.now() - 7140000).toISOString()
    },
    {
      id: 'log-ecom-11',
      log_type: 'agent_action',
      level: 'info',
      message: 'Generando reporte de tendencias y guardando artefacto',
      details: { trends: 'Prendas de lino, tonos neutros, siluetas holgadas' },
      artifacts: [
        { name: 'zara_novedades_report.csv', type: 'text/csv', size: 1024 }
      ],
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-2',
      created_at: new Date(Date.now() - 7120000).toISOString()
    },
    {
      id: 'log-ecom-12',
      log_type: 'system',
      level: 'info',
      message: 'Ejecución finalizada con éxito',
      details: { total_duration_ms: 100000, total_tokens: 2755 },
      instance_id: 'remote-ecom-1',
      site_id: 'demo-ecom-es-456',
      user_id: 'demo-user-456',
      command_id: 'cmd-ecom-2',
      created_at: new Date(Date.now() - 7100000).toISOString()
    }
  ]"""

content = re.sub(r"  instance_logs: \[.*?  \]", instance_logs_new, content, flags=re.DOTALL)

with open('lib/demo-data/demo-ecom-es-456.ts', 'w') as f:
    f.write(content)

