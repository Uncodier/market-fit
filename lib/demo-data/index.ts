import { saas_en_123_data } from './demo-saas-en-123';
import { ecom_es_456_data } from './demo-ecom-es-456';

export const demoProfiles: Record<string, any> = {
  'demo-saas-en-123': saas_en_123_data,
  'demo-ecom-es-456': ecom_es_456_data,
};

export const getDemoData = (siteId: string | null) => {
  if (!siteId) return null;
  return demoProfiles[siteId] || null;
};

// Also export metadata about available demos for the UI picker
export const availableDemos = [
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
