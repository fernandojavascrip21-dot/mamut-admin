import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { ADMIN_HOME_PATH, E2E_DATA_PREFIX, SEED_ACCOUNTS } from './support/e2e.constants';
import { login } from './support/login';
import {
  ARCHIVE_NOTICE,
  ARCHIVE_UNITS,
  BACKEND_URL,
  SELLERS_PATH,
  SELLER_BUSINESS,
  SELLER_PASSWORD,
  SELLER_PHONE,
  e2eStatusSellerEmail,
  e2eStatusSellerName,
} from './support/seller-status.constants';

interface SellerRow {
  id: string;
  fullName: string;
}

interface ProductRow {
  id: number;
  stock: number;
}

async function adminHeaders(request: APIRequestContext): Promise<{ Authorization: string }> {
  const response = await request.post(`${BACKEND_URL}/api/auth/login`, { data: SEED_ACCOUNTS.admin });
  const body = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${body.accessToken}` };
}

// Vendedor de prueba con historial (una entrega y su retiro) y sin piezas a su cargo, creado por API.
async function createSellerWithHistory(request: APIRequestContext, tag: string) {
  const headers = await adminHeaders(request);
  const seller = { fullName: e2eStatusSellerName(tag), email: e2eStatusSellerEmail(tag) };
  const created = await request.post(`${BACKEND_URL}/api/sellers`, {
    headers,
    data: { ...seller, businessName: SELLER_BUSINESS, phone: SELLER_PHONE, password: SELLER_PASSWORD },
  });
  const { id } = (await created.json()) as SellerRow;

  const products = (await (await request.get(`${BACKEND_URL}/api/products`, { headers })).json()) as ProductRow[];
  const productId = products.find((row) => row.stock >= ARCHIVE_UNITS)!.id;
  const delivery = await request.post(`${BACKEND_URL}/api/sellers/${id}/deliveries`, {
    headers,
    data: { requestId: randomUUID(), productId, qty: ARCHIVE_UNITS, unitPrice: null, unitCostWithShipping: null },
  });
  expect(delivery.status()).toBe(201);
  const back = await request.post(`${BACKEND_URL}/api/sellers/${id}/returns`, {
    headers,
    data: { requestId: randomUUID(), productId, qty: ARCHIVE_UNITS },
  });
  expect(back.status()).toBe(201);
  return { ...seller, id };
}

async function loginAsAdmin(page: Page): Promise<void> {
  await login(page, SEED_ACCOUNTS.admin);
  await expect(page).toHaveURL(new RegExp(ADMIN_HOME_PATH));
}

test.describe('Archivar a un vendedor con historial y volver a darlo de alta (HU-45 §10)', () => {
  // Los vendedores de prueba sin historial se borran; el archivado conserva el suyo y ya no sale en las listas.
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

  test('eliminar desde «Editar datos» lo archiva y se puede dar de alta otro con el mismo correo', async ({ page, request }) => {
    const seller = await createSellerWithHistory(request, 'archivar');
    await loginAsAdmin(page);
    await page.goto(`${SELLERS_PATH}/${seller.id}`);
    await page.getByRole('link', { name: 'Editar datos' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Eliminar vendedor' }).click();
    await expect(page.getByText(ARCHIVE_NOTICE, { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Eliminar', exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(`«${seller.fullName}» eliminado`)).toBeVisible();
    for (const path of [SELLERS_PATH, `${SELLERS_PATH}?estado=desactivados`]) {
      await page.goto(path);
      await expect(page.getByRole('link', { name: new RegExp(`Ver a ${seller.fullName}`) })).toHaveCount(0);
    }

    const newName = e2eStatusSellerName('realta');
    await page.goto(`${SELLERS_PATH}/nuevo`);
    await page.getByLabel('Nombre', { exact: true }).fill(newName);
    await page.getByLabel('Nombre del negocio').fill(SELLER_BUSINESS);
    await page.getByLabel('Teléfono').fill(SELLER_PHONE);
    await page.getByLabel('Correo para entrar').fill(seller.email);
    await page.getByLabel('Contraseña temporal').fill(SELLER_PASSWORD);
    await page.getByRole('button', { name: 'Dar de alta vendedor' }).click();
    await expect(page.getByRole('heading', { name: 'Vendedor dado de alta' })).toBeVisible();

    await page.getByRole('link', { name: 'Ver mis vendedores' }).click();
    await expect(page.getByRole('link', { name: new RegExp(`Ver a ${newName}`) })).toBeVisible();
  });
});
