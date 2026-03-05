import { solopreneurUseCases } from './data/solopreneurs';
import { smbsUseCases } from './data/smbs';
import { startupsUseCases } from './data/startups';
import { scaleupsEnterpriseUseCases } from './data/enterprise-scaleups';
import { b2bUseCases } from './data/b2b';
import { b2cUseCases } from './data/b2c';
import { b2b2xUseCases } from './data/b2b2x';

export const useCases = [
  ...solopreneurUseCases,
  ...smbsUseCases,
  ...startupsUseCases,
  ...scaleupsEnterpriseUseCases,
  ...b2bUseCases,
  ...b2cUseCases,
  ...b2b2xUseCases
];
