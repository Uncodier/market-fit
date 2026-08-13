export type TicketLocale = "en" | "es" | "fr" | "de" | "ja"

export type TicketCopy = {
  receipt: string
  kitchen: string
  update: string
  inventory: string
  testPrint: string
  stationSynced: string
  syncLinked: string
  computer: string
  device: string
  paper: string
  readyToPrint: string
  taxId: string
  customer: string
  location: string
  cashier: string
  table: string
  subtotal: string
  discount: string
  tax: string
  total: string
  change: string
  notes: string
  thankYou: string
  order: string
  add: string
  qty: string
  voidLabel: string
  onHand: string
  printed: string
  traceability: string
  ready: string
  dineIn: string
  pickup: string
  delivery: string
  cash: string
  card: string
  transfer: string
  other: string
  payment: string
}

const EN: TicketCopy = {
  receipt: "Receipt",
  kitchen: "Kitchen",
  update: "Update",
  inventory: "Inventory",
  testPrint: "Test print",
  stationSynced: "Ready",
  syncLinked: "Linked to this computer",
  computer: "Computer",
  device: "Device",
  paper: "Paper",
  readyToPrint: "Ready to print",
  taxId: "Tax ID",
  customer: "Customer",
  location: "Location",
  cashier: "Cashier",
  table: "Table",
  subtotal: "Subtotal",
  discount: "Discount",
  tax: "Tax",
  total: "Total",
  change: "Change",
  notes: "Notes",
  thankYou: "Thank you",
  order: "Order",
  add: "Add",
  qty: "Qty",
  voidLabel: "Void",
  onHand: "On hand",
  printed: "Printed",
  traceability: "Traceability",
  ready: "Ready",
  dineIn: "Dine in",
  pickup: "Pickup",
  delivery: "Delivery",
  cash: "Cash",
  card: "Card",
  transfer: "Transfer",
  other: "Other",
  payment: "Payment",
}

const ES: TicketCopy = {
  receipt: "Recibo",
  kitchen: "Cocina",
  update: "Actualización",
  inventory: "Inventario",
  testPrint: "Prueba",
  stationSynced: "Lista",
  syncLinked: "Vinculada a esta computadora",
  computer: "Computadora",
  device: "Dispositivo",
  paper: "Papel",
  readyToPrint: "Lista para imprimir",
  taxId: "ID fiscal",
  customer: "Cliente",
  location: "Sucursal",
  cashier: "Cajero",
  table: "Mesa",
  subtotal: "Subtotal",
  discount: "Descuento",
  tax: "Impuesto",
  total: "Total",
  change: "Cambio",
  notes: "Notas",
  thankYou: "Gracias",
  order: "Pedido",
  add: "Agregar",
  qty: "Cant.",
  voidLabel: "Anular",
  onHand: "Existencia",
  printed: "Impreso",
  traceability: "Trazabilidad",
  ready: "Listo",
  dineIn: "Comer aquí",
  pickup: "Recoger",
  delivery: "Envío",
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  other: "Otro",
  payment: "Pago",
}

const FR: TicketCopy = {
  receipt: "Reçu",
  kitchen: "Cuisine",
  update: "Mise à jour",
  inventory: "Inventaire",
  testPrint: "Test",
  stationSynced: "Prête",
  syncLinked: "Liée à cet ordinateur",
  computer: "Ordinateur",
  device: "Appareil",
  paper: "Papier",
  readyToPrint: "Prête à imprimer",
  taxId: "N. TVA",
  customer: "Client",
  location: "Lieu",
  cashier: "Caissier",
  table: "Table",
  subtotal: "Sous-total",
  discount: "Remise",
  tax: "Taxe",
  total: "Total",
  change: "Monnaie",
  notes: "Notes",
  thankYou: "Merci",
  order: "Commande",
  add: "Ajout",
  qty: "Qté",
  voidLabel: "Annulé",
  onHand: "En stock",
  printed: "Imprimé",
  traceability: "Traçabilité",
  ready: "Prêt",
  dineIn: "Sur place",
  pickup: "À emporter",
  delivery: "Livraison",
  cash: "Espèces",
  card: "Carte",
  transfer: "Virement",
  other: "Autre",
  payment: "Paiement",
}

const DE: TicketCopy = {
  receipt: "Beleg",
  kitchen: "Küche",
  update: "Update",
  inventory: "Inventar",
  testPrint: "Testdruck",
  stationSynced: "Bereit",
  syncLinked: "Mit diesem Computer verbunden",
  computer: "Computer",
  device: "Gerät",
  paper: "Papier",
  readyToPrint: "Bereit zum Drucken",
  taxId: "St.-Nr.",
  customer: "Kunde",
  location: "Standort",
  cashier: "Kassierer",
  table: "Tisch",
  subtotal: "Zwischensumme",
  discount: "Rabatt",
  tax: "Steuer",
  total: "Gesamt",
  change: "Rückgeld",
  notes: "Notizen",
  thankYou: "Danke",
  order: "Bestellung",
  add: "Hinzu",
  qty: "Menge",
  voidLabel: "Storno",
  onHand: "Bestand",
  printed: "Gedruckt",
  traceability: "Rückverfolgung",
  ready: "Bereit",
  dineIn: "Vor Ort",
  pickup: "Abholung",
  delivery: "Lieferung",
  cash: "Bar",
  card: "Karte",
  transfer: "Überweisung",
  other: "Sonstiges",
  payment: "Zahlung",
}

const JA: TicketCopy = {
  receipt: "レシート",
  kitchen: "厨房",
  update: "更新",
  inventory: "在庫",
  testPrint: "テスト印刷",
  stationSynced: "準備完了",
  syncLinked: "このパソコンに接続済み",
  computer: "パソコン",
  device: "デバイス",
  paper: "用紙",
  readyToPrint: "印刷できます",
  taxId: "登録番号",
  customer: "お客様",
  location: "拠点",
  cashier: "担当",
  table: "テーブル",
  subtotal: "小計",
  discount: "割引",
  tax: "税",
  total: "合計",
  change: "お釣り",
  notes: "メモ",
  thankYou: "ありがとうございました",
  order: "注文",
  add: "追加",
  qty: "数量",
  voidLabel: "取消",
  onHand: "在庫数",
  printed: "印刷日",
  traceability: "トレーサビリティ",
  ready: "準備完了",
  dineIn: "店内",
  pickup: "持ち帰り",
  delivery: "配送",
  cash: "現金",
  card: "カード",
  transfer: "振込",
  other: "その他",
  payment: "支払",
}

const COPY: Record<TicketLocale, TicketCopy> = { en: EN, es: ES, fr: FR, de: DE, ja: JA }

export function resolveTicketLocale(raw?: string | null): TicketLocale {
  const key = String(raw || "").slice(0, 2).toLowerCase()
  if (key === "es" || key === "fr" || key === "de" || key === "ja") return key
  return "en"
}

export function ticketCopy(locale?: string | null): TicketCopy {
  return COPY[resolveTicketLocale(locale)]
}

export function ticketLocaleTag(locale?: string | null): string {
  switch (resolveTicketLocale(locale)) {
    case "es":
      return "es-MX"
    case "fr":
      return "fr-FR"
    case "de":
      return "de-DE"
    case "ja":
      return "ja-JP"
    default:
      return "en-US"
  }
}

export function ticketHeading(label: string, locale?: string | null): string {
  return resolveTicketLocale(locale) === "ja" ? label : label.toUpperCase()
}
