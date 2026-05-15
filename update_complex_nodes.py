import re

def update_file(filepath, nodes_str):
    content = open(filepath, "r").read()
    new_content = re.sub(r"  instance_nodes: \[.*?  \],\s*instance_node_contexts: \[.*?  \],", nodes_str, content, flags=re.DOTALL)
    open(filepath, "w").write(new_content)

nodes_saas_new = """  instance_nodes: [
    {
      id: 'node-saas-1',
      site_id: 'demo-saas-en-123',
      instance_id: 'remote-saas-1',
      user_id: 'demo-user-123',
      type: 'prompt',
      title: 'Campaign Core Concept',
      prompt: { text: 'Create a narrative for our new AI Analytics feature launch targeting Enterprise CTOs' },
      settings: { media_type: 'text' },
      result: { text: 'The core message is "Analytics that act, not just report". Focus on how AI agents can automatically find anomalies in data and fix them without human intervention.' },
      status: 'completed',
      position_x: 100,
      position_y: 300,
      width: 320,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-saas-2',
      site_id: 'demo-saas-en-123',
      instance_id: 'remote-saas-1',
      user_id: 'demo-user-123',
      type: 'prompt',
      title: 'Blog Post Draft',
      prompt: { text: 'Expand the core concept into a 1500-word SEO-optimized blog post' },
      settings: { media_type: 'text' },
      result: { text: 'In today\\'s fast-paced enterprise landscape, traditional BI dashboards are no longer enough. Meet Acme AI Analytics: a new paradigm where your data works for you...' },
      status: 'completed',
      position_x: 500,
      position_y: 100,
      width: 360,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-saas-3',
      site_id: 'demo-saas-en-123',
      instance_id: 'remote-saas-1',
      user_id: 'demo-user-123',
      type: 'prompt',
      title: 'LinkedIn Carousel Copy',
      prompt: { text: 'Extract 5 key takeaways from the concept for a LinkedIn Carousel' },
      settings: { media_type: 'text' },
      result: { text: 'Slide 1: Dashboards are dead.\\nSlide 2: Meet actionable AI.\\nSlide 3: Auto-detect anomalies.\\nSlide 4: Zero human intervention.\\nSlide 5: Try Acme AI today.' },
      status: 'completed',
      position_x: 500,
      position_y: 400,
      width: 360,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-saas-4',
      site_id: 'demo-saas-en-123',
      instance_id: 'remote-saas-1',
      user_id: 'demo-user-123',
      type: 'generate-image',
      title: 'Blog Hero Image',
      prompt: { text: 'Abstract 3D rendering of glowing data streams connecting to a cybernetic brain, dark corporate blue and teal' },
      settings: { media_type: 'image' },
      result: { image: { url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800' } },
      status: 'completed',
      position_x: 500,
      position_y: 700,
      width: 360,
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-saas-5',
      site_id: 'demo-saas-en-123',
      instance_id: 'remote-saas-1',
      user_id: 'demo-user-123',
      type: 'generate-image',
      title: 'Carousel Slide 1',
      prompt: { text: 'Minimalist slide background with corporate blue, text "Dashboards are dead"' },
      settings: { media_type: 'image' },
      result: { image: { url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800' } },
      status: 'completed',
      position_x: 950,
      position_y: 350,
      width: 320,
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-saas-6',
      site_id: 'demo-saas-en-123',
      instance_id: 'remote-saas-1',
      user_id: 'demo-user-123',
      type: 'generate-video',
      title: 'Promo Video Teaser',
      prompt: { text: 'Create a 15-second teaser video based on the blog post concept' },
      settings: { media_type: 'video' },
      result: { video: { url: 'https://assets.mixkit.co/videos/preview/mixkit-data-center-server-racks-with-flashing-lights-43224-large.mp4' } },
      status: 'completed',
      position_x: 950,
      position_y: 650,
      width: 320,
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-saas-7',
      site_id: 'demo-saas-en-123',
      instance_id: 'remote-saas-1',
      user_id: 'demo-user-123',
      type: 'publish',
      title: 'Publish to Webflow Blog',
      prompt: { text: 'Push the blog post and hero image to the CMS' },
      settings: {},
      result: { outputs: [{ type: 'text', data: { text: 'Published post "Analytics that act" with ID 8f72a' } }] },
      status: 'completed',
      position_x: 1350,
      position_y: 100,
      width: 320,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-saas-8',
      site_id: 'demo-saas-en-123',
      instance_id: 'remote-saas-1',
      user_id: 'demo-user-123',
      type: 'publish',
      title: 'LinkedIn Campaign',
      prompt: { text: 'Schedule carousel and video for LinkedIn' },
      settings: {},
      result: { outputs: [{ type: 'text', data: { text: 'Scheduled 2 posts for tomorrow at 9:00 AM' } }] },
      status: 'completed',
      position_x: 1350,
      position_y: 500,
      width: 320,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  instance_node_contexts: [
    {
      id: 'edge-saas-1',
      source_node_id: 'node-saas-1',
      target_node_id: 'node-saas-2',
      type: 'prompt-context',
      label: 'Core Concept'
    },
    {
      id: 'edge-saas-2',
      source_node_id: 'node-saas-1',
      target_node_id: 'node-saas-3',
      type: 'prompt-context',
      label: 'Core Concept'
    },
    {
      id: 'edge-saas-3',
      source_node_id: 'node-saas-1',
      target_node_id: 'node-saas-4',
      type: 'prompt-context',
      label: 'Theme'
    },
    {
      id: 'edge-saas-4',
      source_node_id: 'node-saas-3',
      target_node_id: 'node-saas-5',
      type: 'prompt-context',
      label: 'Copy for Slide 1'
    },
    {
      id: 'edge-saas-5',
      source_node_id: 'node-saas-2',
      target_node_id: 'node-saas-6',
      type: 'prompt-context',
      label: 'Script source'
    },
    {
      id: 'edge-saas-6',
      source_node_id: 'node-saas-2',
      target_node_id: 'node-saas-7',
      type: 'publish-slot-content',
      label: 'Post Body'
    },
    {
      id: 'edge-saas-7',
      source_node_id: 'node-saas-4',
      target_node_id: 'node-saas-7',
      type: 'publish-slot-media',
      label: 'Hero Image'
    },
    {
      id: 'edge-saas-8',
      source_node_id: 'node-saas-5',
      target_node_id: 'node-saas-8',
      type: 'publish-slot-media',
      label: 'Carousel Img'
    },
    {
      id: 'edge-saas-9',
      source_node_id: 'node-saas-6',
      target_node_id: 'node-saas-8',
      type: 'publish-slot-media',
      label: 'Promo Video'
    }
  ],"""

nodes_ecom_new = """  instance_nodes: [
    {
      id: 'node-ecom-1',
      site_id: 'demo-ecom-es-456',
      instance_id: 'remote-ecom-1',
      user_id: 'demo-user-456',
      type: 'generate-audience',
      title: 'Target: Compradores de Verano',
      prompt: { text: 'Mujeres de 25-40 años que hayan comprado artículos de playa o lino en el último año' },
      settings: { media_type: 'audience' },
      result: { audience_leads: [{ audience_id: 'aud-444', name: 'María García' }, { audience_id: 'aud-444', name: 'Laura Gómez' }, { audience_id: 'aud-444', name: 'Carmen Ruiz' }] },
      status: 'completed',
      position_x: 100,
      position_y: 200,
      width: 320,
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-ecom-2',
      site_id: 'demo-ecom-es-456',
      instance_id: 'remote-ecom-1',
      user_id: 'demo-user-456',
      type: 'prompt',
      title: 'Copy Newsletter Verano',
      prompt: { text: 'Email persuasivo ofreciendo la nueva colección de lino con 15% OFF' },
      settings: { media_type: 'text' },
      result: { text: '¡El verano ya está aquí! Prepárate para el calor con nuestra nueva colección de lino 100% natural. Usa el código VERANO15 para un 15% de descuento.' },
      status: 'completed',
      position_x: 500,
      position_y: 100,
      width: 320,
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-ecom-3',
      site_id: 'demo-ecom-es-456',
      instance_id: 'remote-ecom-1',
      user_id: 'demo-user-456',
      type: 'generate-image',
      title: 'Banner Principal Newsletter',
      prompt: { text: 'Fotografía de moda, mujer joven con vestido de lino blanco en una playa soleada, estilo editorial' },
      settings: { media_type: 'image' },
      result: { image: { url: 'https://images.unsplash.com/photo-1523359274332-944415848529?auto=format&fit=crop&q=80&w=800' } },
      status: 'completed',
      position_x: 500,
      position_y: 400,
      width: 320,
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-ecom-4',
      site_id: 'demo-ecom-es-456',
      instance_id: 'remote-ecom-1',
      user_id: 'demo-user-456',
      type: 'generate-image',
      title: 'Imagen Producto Destacado',
      prompt: { text: 'Fotografía de producto, conjunto pantalón y camisa de lino beige sobre fondo neutro' },
      settings: { media_type: 'image' },
      result: { image: { url: 'https://images.unsplash.com/photo-1596755094514-f87e32f85e2c?auto=format&fit=crop&q=80&w=800' } },
      status: 'completed',
      position_x: 500,
      position_y: 700,
      width: 320,
      created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-ecom-5',
      site_id: 'demo-ecom-es-456',
      instance_id: 'remote-ecom-1',
      user_id: 'demo-user-456',
      type: 'prompt',
      title: 'Copy Instagram Post',
      prompt: { text: 'Caption para Instagram para el vestido de lino, enfocado en frescura y estilo.' },
      settings: { media_type: 'text' },
      result: { text: 'Menos es más. 🤍 Descubre la ligereza de nuestro nuevo vestido de lino. Perfecto para esos días de calor donde el estilo no se negocia. #ColeccionVerano #LinoNatural' },
      status: 'completed',
      position_x: 900,
      position_y: 100,
      width: 320,
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-ecom-6',
      site_id: 'demo-ecom-es-456',
      instance_id: 'remote-ecom-1',
      user_id: 'demo-user-456',
      type: 'publish',
      title: 'Enviar Campaña Klaviyo',
      prompt: { text: 'Armar template de correo con banner, producto y enviarlo a la audiencia.' },
      settings: {},
      result: { outputs: [{ type: 'text', data: { text: 'Enviado a 324 contactos. Tasa de apertura proyectada: 28%' } }] },
      status: 'completed',
      position_x: 1300,
      position_y: 250,
      width: 320,
      created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'node-ecom-7',
      site_id: 'demo-ecom-es-456',
      instance_id: 'remote-ecom-1',
      user_id: 'demo-user-456',
      type: 'publish',
      title: 'Publicar en IG',
      prompt: { text: 'Subir foto a Instagram con su caption.' },
      settings: {},
      result: { outputs: [{ type: 'text', data: { text: 'Post subido correctamente a @modayestilo' } }] },
      status: 'completed',
      position_x: 1300,
      position_y: 550,
      width: 320,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ],
  instance_node_contexts: [
    {
      id: 'edge-ecom-1',
      source_node_id: 'node-ecom-1',
      target_node_id: 'node-ecom-2',
      type: 'prompt-context',
      label: 'Audience Insight'
    },
    {
      id: 'edge-ecom-2',
      source_node_id: 'node-ecom-1',
      target_node_id: 'node-ecom-6',
      type: 'publish-slot-audience',
      label: 'Destinatarios'
    },
    {
      id: 'edge-ecom-3',
      source_node_id: 'node-ecom-2',
      target_node_id: 'node-ecom-6',
      type: 'publish-slot-content',
      label: 'Email Body'
    },
    {
      id: 'edge-ecom-4',
      source_node_id: 'node-ecom-3',
      target_node_id: 'node-ecom-6',
      type: 'publish-slot-media',
      label: 'Banner'
    },
    {
      id: 'edge-ecom-5',
      source_node_id: 'node-ecom-4',
      target_node_id: 'node-ecom-6',
      type: 'publish-slot-media',
      label: 'Producto'
    },
    {
      id: 'edge-ecom-6',
      source_node_id: 'node-ecom-3',
      target_node_id: 'node-ecom-5',
      type: 'prompt-context',
      label: 'Foto Referencia'
    },
    {
      id: 'edge-ecom-7',
      source_node_id: 'node-ecom-5',
      target_node_id: 'node-ecom-7',
      type: 'publish-slot-content',
      label: 'Caption'
    },
    {
      id: 'edge-ecom-8',
      source_node_id: 'node-ecom-3',
      target_node_id: 'node-ecom-7',
      type: 'publish-slot-media',
      label: 'Foto IG'
    }
  ],"""

update_file("lib/demo-data/demo-saas-en-123.ts", nodes_saas_new)
update_file("lib/demo-data/demo-ecom-es-456.ts", nodes_ecom_new)
print("Updated successfully")