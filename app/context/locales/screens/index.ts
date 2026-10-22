import missingEn from './missing-en.json';
import missingEs from './missing-es.json';
import missingFr from './missing-fr.json';
import missingDe from './missing-de.json';
import missingJa from './missing-ja.json';
import systemEn from './system-en.json';
import systemEs from './system-es.json';
import accountEn from './account-en.json';
import accountEs from './account-es.json';
import authFlowsEn from './auth-flows-en.json';
import authFlowsEs from './auth-flows-es.json';
import commercePagesEn from './commerce-pages-en.json';
import commercePagesEs from './commerce-pages-es.json';
import contentEn from './content-en.json';
import contentEs from './content-es.json';
import detailsEn from './details-en.json';
import detailsEs from './details-es.json';
import operationsEn from './operations-en.json';
import operationsEs from './operations-es.json';
import publicEn from './public-en.json';
import publicEs from './public-es.json';
import bookingFr from './booking-fr.json';
import bookingDe from './booking-de.json';
import bookingJa from './booking-ja.json';
import type { SupportedLocale } from '../../locale-preferences';

export const screenMessages: Record<SupportedLocale, Record<string, string>> = {
  en: {
    ...missingEn, ...systemEn, ...accountEn, ...authFlowsEn, ...commercePagesEn,
    ...contentEn, ...detailsEn, ...operationsEn, ...publicEn,
  },
  es: {
    ...missingEs, ...systemEs, ...accountEs, ...authFlowsEs, ...commercePagesEs,
    ...contentEs, ...detailsEs, ...operationsEs, ...publicEs,
  },
  fr: { ...missingFr, ...bookingFr },
  de: { ...missingDe, ...bookingDe },
  ja: { ...missingJa, ...bookingJa },
};