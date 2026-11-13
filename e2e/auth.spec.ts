import { expect, test } from '@playwright/test';
import { ADMIN_HOME_PATH, SEED_ACCOUNTS, SELLER_HOME_PATH } from './support/e2e.constants';
import { login } from './support/login';

// Prueba de humo: comprueba que front, backend y Supabase local están conectados, con las cuentas del seed.
test.describe('Inicio de sesión (humo)', () => {
  test('el administrador entra a «Stock general»', async ({ page }) => {
    await login(page, SEED_ACCOUNTS.admin);
    await expect(page).toHaveURL(new RegExp(`${ADMIN_HOME_PATH}`));
    await expect(page.getByRole('heading', { level: 1, name: 'Stock general' })).toBeVisible();
  });

  test('el vendedor entra a «Mi stock»', async ({ page }) => {
    await login(page, SEED_ACCOUNTS.seller);
    await expect(page).toHaveURL(new RegExp(`${SELLER_HOME_PATH}`));
    await expect(page.getByRole('heading', { level: 1, name: 'Mi stock' })).toBeVisible();
  });

  test('una cuenta desactivada no entra y ve el mensaje genérico', async ({ page }) => {
    await login(page, SEED_ACCOUNTS.inactive);
    await expect(page.getByRole('alert')).toContainText('Usuario o contraseña incorrectos');
    await expect(page).toHaveURL(/\/login/);
  });
});
