import { AccountType } from '../types';

export interface ChartSeedAccount {
  code: string;
  type: AccountType;
  label: string;
  system: boolean;
  key?: string;
}

export const DEFAULT_CHART: ChartSeedAccount[] = [
  // System accounts
  { code: '1000', type: 'asset', label: 'Cash clearing', system: true },
  { code: '1100', type: 'asset', label: 'Accounts receivable', system: true },
  { code: '2100', type: 'liability', label: 'Tax payable', system: true },
  { code: '3000', type: 'equity', label: 'Equity', system: true },
  { code: '4000', type: 'income', label: 'Revenue', system: true },
  // Default expense accounts (keyed to match current expense categories)
  { code: '5100', type: 'expense', label: 'Content Creation', system: false, key: 'content' },
  { code: '5200', type: 'expense', label: 'Advertising', system: false, key: 'advertising' },
  { code: '5300', type: 'expense', label: 'Software & Tools', system: false, key: 'software' },
  { code: '5400', type: 'expense', label: 'Freelancers', system: false, key: 'freelancers' },
  { code: '5500', type: 'expense', label: 'Events & PR', system: false, key: 'events' },
  { code: '5900', type: 'expense', label: 'Other', system: false, key: 'other' },
];