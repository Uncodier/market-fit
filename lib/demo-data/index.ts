export const availableDemos = [
  {
    id: 'demo-habituall',
    name: 'HabitUall App (Español)',
    description: 'Gestión de espacios de coworking, clubes y estudios de clases deportivas.',
    url: 'https://apps-o8a3yagp1.preview.makinari.com'
  },
  {
    id: 'demo-saas-en-123',
    name: 'SaaS B2B (English)',
    description: 'B2B Software as a Service company targeting enterprise clients.',
    url: 'https://acme-saas.demo'
  },
  {
    id: 'demo-ecom-es-456',
    name: 'Ecommerce (Español)',
    description: 'Tienda en línea de moda rápida para consumidores.',
    url: 'https://moda-rapida.demo'
  }
];

export const getDemoData = async (siteId: string | null) => {
  if (!siteId) return null;
  
  try {
    if (siteId === 'demo-saas-en-123') {
      const module = await import('./demo-saas-en-123');
      return module.saas_en_123_data;
    }
    if (siteId === 'demo-ecom-es-456') {
      const module = await import('./demo-ecom-es-456');
      return module.ecom_es_456_data;
    }
    if (siteId === 'demo-habituall') {
      const module = await import('./demo-habituall');
      return module.habituall_data;
    }
  } catch (error) {
    console.error(`Error loading demo data for ${siteId}:`, error);
  }
  
  return null;
};
