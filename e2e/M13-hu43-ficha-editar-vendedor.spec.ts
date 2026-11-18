import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { ADMIN_HOME_PATH, E2E_DATA_PREFIX, FRONTEND_URL, SEED_ACCOUNTS, SELLER_HOME_PATH } from './support/e2e.constants';
import { login } from './support/login';
import {
  BACKEND_URL,
  SELLER_BUSINESS,
  SELLER_NEW_BUSINESS,
  SELLER_NEW_PHONE,
  SELLER_PASSWORD,
  SELLER_PHONE,
  e2eSellerEmail,
  e2eSellerName,
} from './support/seller-edit.constants';

interface SellerRow {
  id: string;
  fullName: string;
}

// Entra como administrador y espera a llegar al home, para que el siguiente goto no corte el inicio de sesión.
async function loginAsAdmin(page: Page): Promise<void> {
  await login(page, SEED_ACCOUNTS.admin);
  await expect(page).toHaveURL(new RegExp(ADMIN_HOME_PATH));
}

async function adminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${BACKEND_URL}/api/auth/login`, { data: SEED_ACCOUNTS.admin });
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

// Crea por API un vendedor de prueba con negocio, para los flujos que no son el alta.
async function createSeller(request: APIRequestContext, tag: string) {
  const token = await adminToken(request);
  const seller = { fullName: e2eSellerName(tag), email: e2eSellerEmail(tag) };
  const response = await request.post(`${BACKEND_URL}/api/sellers`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { ...seller, businessName: SELLER_BUSINESS, phone: SELLER_PHONE, password: SELLER_PASSWORD },
  });
  const created = (await response.json()) as SellerRow;
  return { ...seller, id: created.id };
}

test.describe('Ficha y edición de un vendedor (HU-43)', () => {
  // Los vendedores de prueba no tienen movimientos: se borran todos los que lleven el prefijo.
  test.afterAll(async ({ request }) => {
    const headers = { Authorization: `Bearer ${await adminToken(request)}` };
    const list = await request.get(`${BACKEND_URL}/api/sellers`, { headers });
    const sellers = (await list.json()) as SellerRow[];
    for (const seller of sellers.filter((row) => row.fullName.startsWith(E2E_DATA_PREFIX))) {
      await request.delete(`${BACKEND_URL}/api/sellers/${seller.id}`, { headers });
    }
  });

  test('el alta con negocio aparece en «Mis vendedores» y en «Viendo»', async ({ page }) => {
    const name = e2eSellerName('alta');
    await loginAsAdmin(page);
    await page.goto('/admin/vendedores/nuevo');
    await page.getByLabel('Nombre', { exact: true }).fill(name);
    await page.getByLabel('Nombre del negocio').fill(SELLER_BUSINESS);
    await page.getByLabel('Teléfono').fill(SELLER_PHONE);
    await page.getByLabel('Correo para entrar').fill(e2eSellerEmail('alta'));
    await page.getByLabel('Contraseña temporal').fill(SELLER_PASSWORD);
    await page.getByRole('button', { name: 'Dar de alta vendedor' }).click();
    await expect(page.getByRole('heading', { name: 'Vendedor dado de alta' })).toBeVisible();

    await page.getByRole('link', { name: 'Ver mis vendedores' }).click();
    await expect(page.getByRole('link', { name: new RegExp(`${name}, ${SELLER_BUSINESS}`) })).toBeVisible();
    await expect(page.getByText(SELLER_BUSINESS).first()).toBeVisible();

    await page.getByRole('combobox', { name: 'Viendo' }).click();
    await expect(page.getByRole('option', { name: `${name} · ${SELLER_BUSINESS}` })).toBeVisible();
  });

  test('«Editar datos» cambia teléfono, negocio y correo, y la ficha y «Viendo» muestran lo nuevo', async ({ page, request }) => {
    const seller = await createSeller(request, 'editar');
    const newEmail = e2eSellerEmail('nuevo');
    await loginAsAdmin(page);
    await page.goto(`/admin/vendedores/${seller.id}`);
    await expect(page.getByRole('heading', { level: 1, name: seller.fullName })).toBeVisible();
    await expect(page.getByText(SELLER_BUSINESS)).toBeVisible();
    await expect(page.getByText('Activo', { exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Editar datos' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Nombre del negocio')).toHaveValue(SELLER_BUSINESS);
    await expect(dialog.getByLabel('Teléfono')).toHaveValue(SELLER_PHONE);
    await dialog.getByLabel('Teléfono').fill(SELLER_NEW_PHONE);
    await dialog.getByLabel('Nombre del negocio').fill(SELLER_NEW_BUSINESS);
    await dialog.getByLabel('Correo para entrar').fill(newEmail);
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(page.getByText(`Datos de «${seller.fullName}» guardados`)).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(SELLER_NEW_BUSINESS)).toBeVisible();
    await expect(page.getByText(SELLER_NEW_PHONE)).toBeVisible();
    await expect(page.getByText(newEmail)).toBeVisible();
    await page.getByRole('combobox', { name: 'Viendo' }).click();
    await expect(page.getByRole('option', { name: `${seller.fullName} · ${SELLER_NEW_BUSINESS}` })).toBeVisible();
  });

  test('con el correo de otra cuenta muestra «Ya existe un acceso con ese correo» y no cierra', async ({ page, request }) => {
    const seller = await createSeller(request, 'duplicado');
    await loginAsAdmin(page);
    await page.goto(`/admin/vendedores/${seller.id}`);
    await page.getByRole('link', { name: 'Editar datos' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Correo para entrar').fill(SEED_ACCOUNTS.seller.email);
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click();

    await expect(dialog.getByText('Ya existe un acceso con ese correo')).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('cerrar con cambios pregunta y «Seguir editando» conserva lo escrito', async ({ page, request }) => {
    const seller = await createSeller(request, 'salir');
    await loginAsAdmin(page);
    await page.goto(`/admin/vendedores/${seller.id}`);
    await page.getByRole('link', { name: 'Editar datos' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Nombre del negocio').fill(SELLER_NEW_BUSINESS);
    await dialog.getByRole('button', { name: 'Cancelar' }).click();

    await expect(page.getByText('¿Salir sin guardar?')).toBeVisible();
    await page.getByRole('button', { name: 'Seguir editando' }).click();
    await expect(dialog.getByLabel('Nombre del negocio')).toHaveValue(SELLER_NEW_BUSINESS);

    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Salir', exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test('después de cambiar el correo, el vendedor entra con el correo nuevo', async ({ page, browser, request }) => {
    const seller = await createSeller(request, 'acceso');
    const newEmail = e2eSellerEmail('acceso-nuevo');
    await loginAsAdmin(page);
    await page.goto(`/admin/vendedores/${seller.id}`);
    await page.getByRole('link', { name: 'Editar datos' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Correo para entrar').fill(newEmail);
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(dialog).toBeHidden();

    const context = await browser.newContext({ baseURL: FRONTEND_URL });
    const sellerPage = await context.newPage();
    await login(sellerPage, { email: newEmail, password: SELLER_PASSWORD });
    await expect(sellerPage).toHaveURL(new RegExp(SELLER_HOME_PATH));
    await context.close();
  });
});
