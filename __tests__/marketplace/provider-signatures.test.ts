/** @jest-environment node */
import { createHmac, randomBytes } from 'node:crypto';
import { verifyRappiSignature, verifyUberSignature } from '../../lib/marketplace/signatures';
import { normalizeWebhook } from '../../lib/marketplace/providers';
import { config } from './provider-fixtures';

describe('marketplace raw-body signatures', () => {
  const body = Buffer.from('{ "event": "offline", "unicode": "é" }\n');
  test('Uber uses client secret, exact bytes, and lowercase hex', () => {
    const secret = randomBytes(32).toString('hex');
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyUberSignature(body, signature, secret)).toBe(true);
    expect(verifyUberSignature(body.toString().trim(), signature, secret)).toBe(false);
    expect(verifyUberSignature(body, signature.toUpperCase(), secret)).toBe(false);
    expect(verifyUberSignature(body, signature, randomBytes(32).toString('hex'))).toBe(false);
    for (const invalid of [null, '', 'invalid', signature.slice(1), `${signature}00`]) {
      expect(verifyUberSignature(body, invalid, secret)).toBe(false);
    }
    expect(verifyUberSignature(body, signature, '')).toBe(false);
  });
  test('Rappi verifies timestamp dot raw bytes and bounds stale/future replay', () => {
    const secret = randomBytes(32).toString('hex');
    const now = Date.now();
    const timestamp = String(Math.floor(now / 1000));
    const signature = createHmac('sha256', secret).update(`${timestamp}.`).update(body).digest('hex');
    const header = `t=${timestamp},sign=${signature}`;
    expect(verifyRappiSignature(body, header, secret, now)).toBe(true);
    expect(verifyRappiSignature(body, `sign=${signature}, t=${timestamp}`, secret, now)).toBe(true);
    expect(verifyRappiSignature(body.toString().trim(), header, secret, now)).toBe(false);
    expect(verifyRappiSignature(body, header, secret, now + 301000)).toBe(false);
    expect(verifyRappiSignature(body, header, secret, now - 301000)).toBe(false);
    expect(verifyRappiSignature(body, header, '', now)).toBe(false);
    for (const invalid of [null, 'invalid', `t=${timestamp},t=${timestamp},sign=${signature}`, `t=NaN,sign=${signature}`, `t=${timestamp},sign=aa`, `t=${timestamp},v1=${signature}`]) {
      expect(verifyRappiSignature(body, invalid, secret, now)).toBe(false);
    }
  });
  test('official scheduled zero shape is verified without reconstructing raw body', () => {
    const connection = config('rappi');
    const raw = JSON.stringify({ action: 'scheduled', store: { internal_id: connection.store_id },
      order_detail: { order_id: 'scheduled-order', delivery_method: 'delivery', place_at: '2026-07-22 17:35:00',
        totals: { total_order: 0, total_to_pay: 0, charges: {}, other_totals: { tip: 0 } },
        items: [{ id: 'product', name: 'Product', quantity: 4, price: 0 }] } });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', connection.webhook_secret!).update(`${timestamp}.${raw}`).digest('hex');
    expect(verifyRappiSignature(raw, `t=${timestamp},sign=${signature}`, connection.webhook_secret!)).toBe(true);
    expect(normalizeWebhook(connection, JSON.parse(raw)).normalized_order).toMatchObject({ totals_provisional: true, subtotal: 0, discount_total: 0 });
    expect(verifyRappiSignature(`${raw}\n`, `t=${timestamp},sign=${signature}`, connection.webhook_secret!)).toBe(false);
  });
});