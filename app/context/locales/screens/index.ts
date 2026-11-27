import missingEn from './missing-en.json';
import dealsEn from './deals-en.json';
import dealsEs from './deals-es.json';
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
import filesEn from './files-en.json';
import operationsEn from './operations-en.json';
import operationsEs from './operations-es.json';
import operationsFr from './operations-fr.json';
import operationsDe from './operations-de.json';
import operationsJa from './operations-ja.json';
import publicEn from './public-en.json';
import publicEs from './public-es.json';
import bookingFr from './booking-fr.json';
import bookingDe from './booking-de.json';
import bookingJa from './booking-ja.json';
import procurementSharedEn from './procurement-shared-en.json';
import procurementSharedEs from './procurement-shared-es.json';
import procurementSharedFr from './procurement-shared-fr.json';
import procurementSharedDe from './procurement-shared-de.json';
import procurementSharedJa from './procurement-shared-ja.json';
import type { SupportedLocale } from '../../locale-preferences';
import previewEn from './workspace-preview-en.json';
import previewEs from './workspace-preview-es.json';
import previewFr from './workspace-preview-fr.json';
import previewDe from './workspace-preview-de.json';
import previewJa from './workspace-preview-ja.json';

export const screenMessages: Record<SupportedLocale, Record<string, string>> = {
  en: {
    ...missingEn, ...systemEn, ...accountEn, ...authFlowsEn, ...commercePagesEn,
    ...contentEn, ...detailsEn, ...operationsEn, ...publicEn, ...procurementSharedEn, ...dealsEn, ...previewEn, ...filesEn,
  },
  es: {
    ...missingEs, ...systemEs, ...accountEs, ...authFlowsEs, ...commercePagesEs,
    ...contentEs, ...detailsEs, ...operationsEs, ...publicEs, ...procurementSharedEs, ...dealsEs, ...previewEs,
  },
  fr: { ...missingFr, ...operationsFr, ...bookingFr, ...procurementSharedFr, ...previewFr },
  de: { ...missingDe, ...operationsDe, ...bookingDe, ...procurementSharedDe, ...previewDe },
  ja: { ...missingJa, ...operationsJa, ...bookingJa, ...procurementSharedJa, ...previewJa },
};