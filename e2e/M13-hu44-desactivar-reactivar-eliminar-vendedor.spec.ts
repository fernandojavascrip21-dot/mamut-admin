import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { ADMIN_HOME_PATH, E2E_DATA_PREFIX, FRONTEND_URL, SEED_ACCOUNTS, SELLER_HOME_PATH } from './support/e2e.constants';
import { login } from './support/login';
import {
  BACKEND_URL,
  DEACTIVATE_MAIL_WARNING,
  HAS_UNITS_ALERT,
  REACTIVATE_MAIL_WARNING,
  SEED_SELLER_NAME,
  SELLERS_INACTIVE_PATH,
  SELLERS_PATH,
  SELLER_BUSINESS,
  SELLER_PASSWORD,
  SELLER_PHONE,
  WAREHOUSE_LABEL,
  e2eStatusSellerEmail,
  e2eStatusSellerName,
} from './support/seller-status.constants';

interface SellerRow {
  id: string;
  fullName: string;
}

// Entra como administrador y espera a llegar al home, para que el siguiente goto no corte el inicio de sesión.
async function loginAsAdmin(page: Page): Promise<void> {
  await login(page, SEED_ACCOUNTS.admin);
  await expect(page).toHaveURL(new RegExp(ADMIN_HOME_PATH));
}

async function adminHeaders(request: APIRequestContext): Promise<{ Authorization: string }> {
  const response = await request.post(`${BACKEND_URL}/api/auth/login`, { data: SEED_ACCOUNTS.admin });
  const body = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${body.accessToken}` };
}

// Crea por API un vendedor de prueba, sin movimientos, con negocio.
async function createSeller(request: APIRequestContext, tag: string) {
  const seller = { fullName: e2eStatusSellerName(tag), email: e2eStatusSellerEmail(tag) };
  const response = await request.post(`${BACKEND_URL}/api/sellers`, {
    headers: await adminHeaders(request),
    data: { ...seller, businessName: SELLER_BUSINESS, phone: SELLER_PHONE, password: SELLER_PASSWORD },
  });
  const created = (await response.json()) as SellerRow;
  return { ...seller, id: created.id };
}

// Cambia el estado por API, para los flujos que no son el de desactivar o reactivar.
async function setStatus(request: APIRequestContext, id: string, action: 'deactivate' | 'reactivate'): Promise<void> {
  const response = await request.post(`${BACKEND_URL}/api/sellers/${id}/${action}`, { headers: await adminHeaders(request) });
  expect(response.status()).toBe(200);
}

// Abre «Editar datos» desde la ficha del vendedor.
async function openEditDialog(page: Page, id: string) {
  await page.goto(`${SELLERS_PATH}/${id}`);
  await page.getByRole('link', { name: 'Editar datos' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Estado del vendedor')).toBeVisible();
  return dialog;
}

const rowLink = (page: Page, name: string) => page.getByRole('link', { name: new RegExp(`Ver a ${name}`) });
const viewingBar = (page: Page) => page.getByRole('combobox', { name: 'Viendo' });

test.describe('Desactivar, reactivar y eliminar un vendedor (HU-44)', () => {
  // Los vendedores de prueba no tienen movimientos: se borran todos los que lleven el prefijo, activos o no.
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

  test('desactivar desde «Editar datos»: la ficha, «Viendo», las listas y el acceso cambian', async ({ page, browser, request }) => {
    const seller = await createSeller(request, 'desactivar');
    await loginAsAdmin(page);
    await page.goto(SELLERS_PATH);
    await rowLink(page, seller.fullName).click();
    await expect(page.getByRole('heading', { level: 1, name: seller.fullName })).toBeVisible();
    await expect(viewingBar(page)).toContainText(seller.fullName);

    const dialog = await openEditDialog(page, seller.id);
    await dialog.getByRole('button', { name: 'Desactivar vendedor' }).click();
    await expect(page.getByText(`¿Desactivar a «${seller.fullName}»?`)).toBeVisible();
    await page.getByRole('button', { name: 'Desactivar', exact: true }).click();

    await expect(page.getByText(DEACTIVATE_MAIL_WARNING)).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('Desactivado', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reactivar', exact: true })).toBeVisible();
    await expect(page.getByText('Está desactivado')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dejar producto' })).toHaveCount(0);

    await expect(viewingBar(page)).toContainText(WAREHOUSE_LABEL);
    await viewingBar(page).click();
    await expect(page.getByRole('option', { name: `${seller.fullName} · ${SELLER_BUSINESS}` })).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.goto(SELLERS_PATH);
    await expect(page.getByRole('heading', { level: 1, name: 'Mis vendedores' })).toBeVisible();
    await expect(rowLink(page, seller.fullName)).toHaveCount(0);
    await page.getByText('Desactivados', { exact: true }).click();
    await expect(page).toHaveURL(/estado=desactivados/);
    await expect(rowLink(page, seller.fullName)).toHaveAttribute(
      'aria-label',
      `Ver a ${seller.fullName}, ${SELLER_BUSINESS}, desactivado`,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.reload();
    await expect(rowLink(page, seller.fullName)).toBeVisible();
    await rowLink(page, seller.fullName).click();
    await page.getByRole('link', { name: '‹ Vendedores' }).click();
    await expect(page).toHaveURL(new RegExp(SELLERS_INACTIVE_PATH.replace('?', '\\?')));

    const context = await browser.newContext({ baseURL: FRONTEND_URL });
    const sellerPage = await context.newPage();
    await login(sellerPage, { email: seller.email, password: SELLER_PASSWORD });
    await expect(sellerPage.getByRole('alert')).toContainText('Usuario o contraseña incorrectos');
    await expect(sellerPage).toHaveURL(/\/login/);
    await context.close();
  });

  test('con su sesión abierta, al desactivarlo su siguiente acción lo manda al login', async ({ page, browser, request }) => {
    const seller = await createSeller(request, 'sesion');
    const context = await browser.newContext({ baseURL: FRONTEND_URL });
    const sellerPage = await context.newPage();
    await login(sellerPage, { email: seller.email, password: SELLER_PASSWORD });
    await expect(sellerPage).toHaveURL(new RegExp(SELLER_HOME_PATH));

    await loginAsAdmin(page);
    await setStatus(request, seller.id, 'deactivate');

    await sellerPage.reload();
    await expect(sellerPage).toHaveURL(/\/login/);
    await context.close();
  });

  test('«Reactivar» desde la ficha lo devuelve a Activos, a «Viendo» y le da acceso', async ({ page, browser, request }) => {
    const seller = await createSeller(request, 'reactivar');
    await setStatus(request, seller.id, 'deactivate');
    await loginAsAdmin(page);
    await page.goto(`${SELLERS_PATH}/${seller.id}`);
    await expect(page.getByText('Está desactivado')).toBeVisible();

    await page.getByRole('button', { name: 'Reactivar', exact: true }).click();
    await expect(page.getByText(REACTIVATE_MAIL_WARNING)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dejar producto' })).toBeVisible();
    await expect(page.getByText('Está desactivado')).toHaveCount(0);
    await expect(viewingBar(page)).toContainText(seller.fullName);

    await page.goto(SELLERS_PATH);
    await expect(rowLink(page, seller.fullName)).toBeVisible();

    const context = await browser.newContext({ baseURL: FRONTEND_URL });
    const sellerPage = await context.newPage();
    await login(sellerPage, { email: seller.email, password: SELLER_PASSWORD });
    await expect(sellerPage).toHaveURL(new RegExp(SELLER_HOME_PATH));
    await context.close();
  });

  test('«Eliminar vendedor» sin movimientos lo borra y vuelve a «Mis vendedores»', async ({ page, request }) => {
    const seller = await createSeller(request, 'eliminar');
    await loginAsAdmin(page);
    const dialog = await openEditDialog(page, seller.id);
    await dialog.getByRole('button', { name: 'Eliminar vendedor' }).click();
    await expect(page.getByText(`¿Eliminar a «${seller.fullName}»?`)).toBeVisible();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();

    await expect(page.getByText(`«${seller.fullName}» eliminado`)).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/vendedores$/);
    await expect(rowLink(page, seller.fullName)).toHaveCount(0);
    await page.getByText('Desactivados', { exact: true }).click();
    await expect(page).toHaveURL(/estado=desactivados/);
    await expect(rowLink(page, seller.fullName)).toHaveCount(0);
  });

  test('eliminar a un desactivado vuelve a la lista de «Desactivados»', async ({ page, request }) => {
    const seller = await createSeller(request, 'eliminar-inactivo');
    await setStatus(request, seller.id, 'deactivate');
    await loginAsAdmin(page);
    const dialog = await openEditDialog(page, seller.id);
    await expect(dialog.getByRole('button', { name: 'Reactivar vendedor' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Eliminar vendedor' }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/admin\/vendedores\?estado=desactivados/);
    await expect(rowLink(page, seller.fullName)).toHaveCount(0);
  });

  test('con piezas o historial no se desactiva ni se elimina: avisa y sigue activo', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(SELLERS_PATH);
    await rowLink(page, SEED_SELLER_NAME).click();
    await expect(page.getByRole('heading', { level: 1, name: SEED_SELLER_NAME })).toBeVisible();
    const sellerUrl = page.url();

    await page.getByRole('link', { name: 'Editar datos' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Desactivar vendedor' }).click();
    await page.getByRole('button', { name: 'Desactivar', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText(HAS_UNITS_ALERT);

    await dialog.getByRole('button', { name: 'Retirar producto' }).click();
    await expect(page).toHaveURL(/retirar/);
    await expect(dialog.getByText('Estado del vendedor')).toHaveCount(0);

    const editDialog = await openEditDialog(page, sellerUrl.split('/').pop()!);
    await editDialog.getByRole('button', { name: 'Eliminar vendedor' }).click();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();
    await expect(editDialog.getByRole('alert')).toContainText(HAS_UNITS_ALERT);
    await expect(editDialog).toBeVisible();

    await page.goto(sellerUrl);
    await expect(page.getByText('Activo', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dejar producto' })).toBeVisible();
  });
});
