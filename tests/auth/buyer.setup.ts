import { test as setup } from '@playwright/test';
import { authenticate } from '../support/authenticate';

setup.use({ trace: 'off', video: 'off', screenshot: 'off' });
setup('authenticate dedicated buyer', async ({ page }) => {
  await authenticate(page, 'buyer');
});