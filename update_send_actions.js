const fs = require('fs');

const orderActionsPath = 'app/orders/send-actions.ts';
let orderContent = fs.readFileSync(orderActionsPath, 'utf8');

// Eliminar sendOrderPaymentReminder
const reminderIndex = orderContent.indexOf('export async function sendOrderPaymentReminder');
if (reminderIndex !== -1) {
  orderContent = orderContent.substring(0, reminderIndex);
}
// Remover import de send-payment-reminder
orderContent = orderContent.replace(/import\s*\{\s*buildPaymentReminderEmailSubject,\s*sendPaymentReminderEmailViaSendGrid,\s*\}\s*from\s*"@\/app\/documents\/send-payment-reminder"\s*/g, '');

fs.writeFileSync(orderActionsPath, orderContent);

const saleActionsPath = 'app/sales/send-actions.ts';
let saleContent = fs.readFileSync(saleActionsPath, 'utf8');

// Eliminar sendSalePaymentReminder
const saleReminderIndex = saleContent.indexOf('export async function sendSalePaymentReminder');
if (saleReminderIndex !== -1) {
  saleContent = saleContent.substring(0, saleReminderIndex);
}
// Remover import de send-payment-reminder
saleContent = saleContent.replace(/import\s*\{\s*buildPaymentReminderEmailSubject,\s*sendPaymentReminderEmailViaSendGrid,\s*\}\s*from\s*"@\/app\/documents\/send-payment-reminder"\s*/g, '');

fs.writeFileSync(saleActionsPath, saleContent);
