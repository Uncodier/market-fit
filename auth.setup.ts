import { test as setup } from '@playwright/test';
import { authenticate } from './tests/support/authenticate';

// Login traces can contain passwords and session tokens. Never publish them.
setup.use({ trace: 'off', video: 'off', screenshot: 'off' });
setup('authenticate admin', async ({ page }) => {
  await authenticate(page, 'admin');
});
