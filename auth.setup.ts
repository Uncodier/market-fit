import { test as setup } from '@playwright/test';

setup('authenticate admin', async ({ page }) => {
  if (!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD) {
    console.warn('Skipping admin auth: TEST_ADMIN_EMAIL or TEST_ADMIN_PASSWORD not set in environment.');
    return;
  }

  // Ir a la página de login
  await page.goto('/auth');

  // Llenar el formulario (las cajas tienen name="email" y name="password" por react-hook-form)
  await page.locator('input[name="email"]').fill(process.env.TEST_ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(process.env.TEST_ADMIN_PASSWORD);

  // El botón de enviar
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // El redirect default tras el login en el app deployment es a /projects
  await page.waitForURL('**/projects*');

  // Guardar la sesión
  await page.context().storageState({ path: '.auth/admin.json' });
});
