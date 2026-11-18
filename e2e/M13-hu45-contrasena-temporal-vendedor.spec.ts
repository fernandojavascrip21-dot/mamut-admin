import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { ADMIN_HOME_PATH, E2E_DATA_PREFIX, SEED_ACCOUNTS } from './support/e2e.constants';
import { login } from './support/login';
import {
  BACKEND_URL,
  CHANGE_PASSWORD_LABEL,
  PASSWORD_MAIL_WARNING,
  PASSWORD_MISMATCH_ERROR,
  PASSWORD_REQUIRED_ERROR,
  SELLERS_PATH,
  SELLER_NEW_PASSWORD,
  SELLER_OLD_PASSWORD,
  SELLER_PHONE,
  e2ePasswordSellerEmail,
  e2ePasswordSellerName,
} from './support/seller-password.constants';

interface SellerRow {
  id: string;
  fullName: string;
}

async function adminHeaders(request: APIRequestContext): Promise<{ Authorization: string }> {
  const response = await request.post(`${BACKEND_URL}/api/auth/login`, { data: SEED_ACCOUNTS.admin });
  const body = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${body.accessToken}` };
}

// Crea por API un vendedor de prueba, sin movimientos.
async function createSeller(request: APIRequestContext, tag: string) {
  const seller = { fullName: e2ePasswordSellerName(tag), email: e2ePasswordSellerEmail(tag) };
  const response = await request.post(`${BACKEND_URL}/api/sellers`, {
    headers: await adminHeaders(request),
    data: { ...seller, phone: SELLER_PHONE, password: SELLER_OLD_PASSWORD },
  });
  const created = (await response.json()) as SellerRow;
  return { ...seller, id: created.id };
}

async function loginAs(page: Page, account: { email: string; password: string }, home: RegExp): Promise<void> {
  await login(page, account);
  await expect(page).toHaveURL(home);
}

function passwordFields(page: Page) {
  const dialog = page.getByRole('dialog');
  return {
    dialog,
    password: dialog.getByLabel('Contraseña temporal', { exact: true }),
    confirmation: dialog.getByLabel('Confirmar contraseña', { exact: true }),
  };
}

test.describe('Contraseña temporal de un vendedor (HU-45)', () => {
  // Los vendedores de prueba no tienen movimientos: se borran todos los que lleven el prefijo.
  test.afterAll(async ({ request }) => {
    const headers = await adminHeaders(request);
    for (const query of ['', '?status=inactive']) {
      const list = await request.get(`${BACKEND_URL}/api/sellers${query}`, { headers });
      const sellers = (await list.json()) as SellerRow[];
      for (const seller of sellers.filter((row) => row.fullName.startsWith(E2E_DATA_PREFIX))) {
        await request.delete(`${BACKEND_URL}/api/sellers/${seller.id}`, { headers });
      }
    }
  });

  test('cambiar la contraseña: errores al enviar, aviso, sesión cerrada y acceso con la nueva', async ({ page, browser, request }) => {
    const seller = await createSeller(request, 'cambiar');

    // El vendedor ya tiene su sesión abierta en otro contexto del navegador.
    const sellerContext = await browser.newContext();
    const sellerPage = await sellerContext.newPage();
    await loginAs(sellerPage, { email: seller.email, password: SELLER_OLD_PASSWORD }, /vendedor\/mi-stock/);

    await loginAs(page, SEED_ACCOUNTS.admin, new RegExp(ADMIN_HOME_PATH));
    await page.goto(`${SELLERS_PATH}/${seller.id}`);
    await expect(page.getByRole('heading', { level: 1, name: seller.fullName })).toBeVisible();
    await page.getByRole('link', { name: CHANGE_PASSWORD_LABEL }).click();

    const { dialog, password, confirmation } = passwordFields(page);
    await expect(dialog.getByText(`Para ${seller.fullName}`)).toBeVisible();
    await expect(dialog.getByText('Mínimo 8 caracteres. Dísela en persona al vendedor.')).toBeVisible();

    await dialog.getByRole('button', { name: CHANGE_PASSWORD_LABEL }).click();
    await expect(dialog.getByText(PASSWORD_REQUIRED_ERROR)).toBeVisible();

    await password.fill('1234567');
    await confirmation.fill('1234567');
    await dialog.getByRole('button', { name: CHANGE_PASSWORD_LABEL }).click();
    await expect(dialog.getByText('Usa al menos 8 caracteres')).toBeVisible();

    await password.fill(SELLER_NEW_PASSWORD);
    await confirmation.fill(`${SELLER_NEW_PASSWORD}x`);
    await dialog.getByRole('button', { name: CHANGE_PASSWORD_LABEL }).click();
    await expect(dialog.getByText(PASSWORD_MISMATCH_ERROR)).toBeVisible();

    await confirmation.fill(SELLER_NEW_PASSWORD);
    await dialog.getByRole('button', { name: CHANGE_PASSWORD_LABEL }).click();
    await expect(page.getByText(PASSWORD_MAIL_WARNING)).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(SELLER_NEW_PASSWORD)).toHaveCount(0);
    expect(page.url()).not.toContain(SELLER_NEW_PASSWORD);
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(stored).not.toContain(SELLER_NEW_PASSWORD);

    // Su siguiente acción en el otro contexto lo lleva al login; la vieja falla y la nueva entra.
    await sellerPage.reload();
    await expect(sellerPage).toHaveURL(/login/);
    await sellerPage.getByLabel('Usuario').fill(seller.email);
    await sellerPage.getByLabel('Contraseña', { exact: true }).fill(SELLER_OLD_PASSWORD);
    await sellerPage.locator('button[type="submit"]').click();
    await expect(sellerPage).toHaveURL(/login/);
    await sellerPage.getByLabel('Contraseña', { exact: true }).fill(SELLER_NEW_PASSWORD);
    await sellerPage.locator('button[type="submit"]').click();
    await expect(sellerPage).toHaveURL(/vendedor\/mi-stock/);
    await sellerContext.close();
  });

  test('el ojo muestra y oculta cada campo, y a 375 px o en escritorio el pop-up no se desborda', async ({ page, request }) => {
    const seller = await createSeller(request, 'ojo');
    await loginAs(page, SEED_ACCOUNTS.admin, new RegExp(ADMIN_HOME_PATH));
    await page.goto(`${SELLERS_PATH}/${seller.id}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('link', { name: CHANGE_PASSWORD_LABEL }).click();

    const { dialog, password, confirmation } = passwordFields(page);
    await password.fill(SELLER_NEW_PASSWORD);
    await confirmation.fill(SELLER_NEW_PASSWORD);
    await expect(password).toHaveAttribute('type', 'password');
    await dialog.locator('.p-password-toggle-mask-icon').first().click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(confirmation).toHaveAttribute('type', 'password');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
  });

  test('un desactivado no ofrece «Cambiar contraseña» y su enlace directo no muestra formulario', async ({ page, request }) => {
    const seller = await createSeller(request, 'desactivado');
    const headers = await adminHeaders(request);
    const response = await request.post(`${BACKEND_URL}/api/sellers/${seller.id}/deactivate`, { headers });
    expect(response.status()).toBe(200);

    await loginAs(page, SEED_ACCOUNTS.admin, new RegExp(ADMIN_HOME_PATH));
    await page.goto(`${SELLERS_PATH}/${seller.id}`);
    await expect(page.getByRole('button', { name: 'Reactivar', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: CHANGE_PASSWORD_LABEL })).toHaveCount(0);

    await page.goto(`/admin/(ventana:vendedor/${seller.id}/contrasena)`);
    await expect(page.getByRole('dialog').getByText('Está desactivado. Reactívalo para cambiarle la contraseña.')).toBeVisible();
    await expect(page.getByRole('dialog').getByLabel('Contraseña temporal', { exact: true })).toHaveCount(0);
  });
});
