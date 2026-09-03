import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Iniciando seed de datos para pruebas E2E...');

  // 1. Obtener el Site principal (asumiendo que el admin tiene acceso al primer site)
  const { data: sites, error: siteError } = await supabase.from('sites').select('id').limit(1);
  if (siteError || !sites || sites.length === 0) {
    console.error('Error al obtener el site:', siteError);
    return;
  }
  const siteId = sites[0].id;
  console.log(`Usando Site ID: ${siteId}`);

  // 2. Crear un Item Reservable si no existe
  const itemName = 'Reservable Item Agent';
  let { data: items, error: itemError } = await supabase
    .from('catalog_items')
    .select('id')
    .eq('site_id', siteId)
    .eq('name', itemName);

  let itemId;
  if (!items || items.length === 0) {
    console.log(`Creando item: ${itemName}...`);
    const { data: newItem, error: createItemError } = await supabase
      .from('catalog_items')
      .insert({
        site_id: siteId,
        name: itemName,
        type: 'service',
        is_reservable: true,
        price: 50.00,
        currency: 'USD',
        status: 'active'
      })
      .select('id')
      .single();
    
    if (createItemError) {
      console.error('Error creando catalog_item:', createItemError);
    } else {
      itemId = newItem.id;
    }
  } else {
    itemId = items[0].id;
    console.log(`El item '${itemName}' ya existe (ID: ${itemId}).`);
  }

  // 3. Crear Schedule para el Item Reservable
  if (itemId) {
    const { data: schedules } = await supabase
      .from('reservation_schedules')
      .select('id')
      .eq('site_id', siteId)
      .eq('catalog_item_id', itemId);

    if (!schedules || schedules.length === 0) {
      console.log(`Creando schedule para el item ${itemId}...`);
      const { error: scheduleError } = await supabase.from('reservation_schedules').insert({
        site_id: siteId,
        catalog_item_id: itemId,
        name: 'Horario de Prueba E2E',
        duration_minutes: 60,
        capacity: 10,
        timezone: 'America/Los_Angeles',
        days: {
          monday: { enabled: true, timeBlocks: [{ start: "09:00", end: "17:00" }] },
          tuesday: { enabled: true, timeBlocks: [{ start: "09:00", end: "17:00" }] },
          wednesday: { enabled: true, timeBlocks: [{ start: "09:00", end: "17:00" }] },
          thursday: { enabled: true, timeBlocks: [{ start: "09:00", end: "17:00" }] },
          friday: { enabled: true, timeBlocks: [{ start: "09:00", end: "17:00" }] },
          saturday: { enabled: true, timeBlocks: [{ start: "09:00", end: "17:00" }] },
          sunday: { enabled: true, timeBlocks: [{ start: "09:00", end: "17:00" }] }
        }
      });
      if (scheduleError) console.error('Error creando schedule:', scheduleError);
      else console.log('Schedule creado exitosamente.');
    } else {
      console.log('El schedule ya existe para este item.');
    }
  }

  // 4. Crear "Automated Expense Campaign" para evitar el timeout en crud-transaction
  const campaignTitle = 'Automated Expense Campaign';
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id')
    .eq('site_id', siteId)
    .eq('title', campaignTitle);

  if (!campaigns || campaigns.length === 0) {
    console.log(`Creando campaign: ${campaignTitle}...`);
    const { error: campaignError } = await supabase.from('campaigns').insert({
      site_id: siteId,
      title: campaignTitle,
      status: 'active'
    });
    if (campaignError) console.error('Error creando campaign:', campaignError);
    else console.log('Campaign creada exitosamente.');
  } else {
    console.log('La campaign ya existe.');
  }

  // 5. Crear "POS Reservator" cliente si no existe
  const leadName = 'POS Reservator';
  const { data: leads } = await supabase
    .from('leads')
    .select('id')
    .eq('site_id', siteId)
    .eq('name', leadName);

  if (!leads || leads.length === 0) {
    console.log(`Creando cliente: ${leadName}...`);
    const { error: leadError } = await supabase.from('leads').insert({
      site_id: siteId,
      name: leadName,
      email: `pos-reservator-${Date.now()}@marketfit.test`
    });
    if (leadError) console.error('Error creando lead:', leadError);
    else console.log('Cliente creado exitosamente.');
  } else {
    console.log('El cliente ya existe.');
  }

  console.log('Seed completado.');
}

seed().catch(console.error);