import fs from 'node:fs';
import path from 'node:path';
import { required, requiredUuid } from '../../support/environment';
import { targetEnvDefaults } from '../agent-evidence';

function fixturePath(): string {
  targetEnvDefaults(required(process.env, 'TEST_TARGET'));
  const runId = required(process.env, 'AGENT_VERIFICATION_RUN_ID');
  if (!/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error('Invalid agent run namespace');
  return path.resolve(__dirname, '.runtime', runId, 'fixture.json');
}

export function itemName(): string {
  fixturePath();
  return `Shiplight Reservation ${required(process.env, 'AGENT_VERIFICATION_RUN_ID')}`;
}

export function saveItem(itemId: string): void {
  requiredUuid({ ITEM: itemId }, 'ITEM');
  const file = fixturePath();
  if (fs.existsSync(file)) throw new Error('Item evidence already exists; never reuse a prior creation attempt');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ itemId, itemName: itemName(), siteId: requiredUuid(process.env, 'TEST_SITE_ID'), runId: process.env.AGENT_VERIFICATION_RUN_ID }), { mode: 0o600, flag: 'wx' });
}

export function loadItem(): { itemId: string; itemName: string; siteId: string; runId: string } {
  const item = JSON.parse(fs.readFileSync(fixturePath(), 'utf8'));
  if (item.runId !== process.env.AGENT_VERIFICATION_RUN_ID || item.siteId !== process.env.TEST_SITE_ID || item.itemName !== itemName()) {
    throw new Error('Reservation fixture belongs to a different execution/site');
  }
  requiredUuid({ ITEM: item.itemId }, 'ITEM');
  return item;
}