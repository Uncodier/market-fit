import { mergeDemoData } from "./merge"

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
      const [base, commerce, records, workflows, context] = await Promise.all([
        import('./demo-saas-en-123'),
        import('./saas/commerce'),
        import('./saas/records'),
        import('./saas/workflows'),
        import('./saas/context'),
      ]);
      return mergeDemoData(
        base.saas_en_123_data,
        commerce.saasCommerce,
        records.saasRecords,
        workflows.saasWorkflows,
        context.saasContext
      );
    }
    if (siteId === 'demo-ecom-es-456') {
      const [base, commerce, records, workflows, context] = await Promise.all([
        import('./demo-ecom-es-456'),
        import('./ecom/commerce'),
        import('./ecom/records'),
        import('./ecom/workflows'),
        import('./ecom/context'),
      ]);
      return mergeDemoData(
        base.ecom_es_456_data,
        commerce.ecomCommerce,
        records.ecomRecords,
        workflows.ecomWorkflows,
        context.ecomContext
      );
    }
    if (siteId === 'demo-habituall') {
      const [base, commerce, records, workflows, context] = await Promise.all([
        import('./demo-habituall'),
        import('./habituall/commerce'),
        import('./habituall/records'),
        import('./habituall/workflows'),
        import('./habituall/context'),
      ]);
      return mergeDemoData(
        base.habituall_data,
        commerce.habituallCommerce,
        records.habituallRecords,
        workflows.habituallWorkflows,
        context.habituallContext
      );
    }
  } catch (error) {
    console.error(`Error loading demo data for ${siteId}:`, error);
  }
  
  return null;
};
