import type { Page } from '@playwright/test';

// Inicia sesión desde /login como lo hace una persona: escribe usuario y contraseña y envía.
// Las pruebas de cada spec la usan para entrar con la cuenta del rol que necesitan.
export async function login(page: Page, account: { email: string; password: string }): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Usuario').fill(account.email);
  await page.getByLabel('Contraseña', { exact: true }).fill(account.password);
  await page.locator('button[type="submit"]').click();
}
