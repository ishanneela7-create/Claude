import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('grid', { name: 'Parts table' })).toBeVisible();
});

test('locations: add a bin, move it, and open its QR code', async ({ page, request }) => {
  await page.getByRole('button', { name: 'Manage' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Locations and bins' });
  await dialog.getByLabel('New location name').fill('E2E Room');
  await dialog.getByRole('button', { name: 'Add top level' }).click();
  await dialog.getByLabel('New location name').fill('E2E Bin');
  await dialog.getByRole('button', { name: 'Add inside selected' }).click();
  await expect(dialog.getByRole('treeitem', { name: /E2E Bin/ })).toBeVisible();

  const tree = (await (await request.get('/api/locations')).json()) as Array<{
    id: string;
    name: string;
    children: Array<{ id: string }>;
  }>;
  const room = tree.find((node) => node.name === 'E2E Room');
  expect(room?.children).toHaveLength(1);
  const qr = await request.get(`/api/locations/${room?.children[0]?.id}/qr`);
  expect(qr.headers()['content-type']).toContain('image/svg+xml');

  await dialog.getByLabel(/Move to/).selectOption({ label: 'Garage' });
  await expect(page.getByText('Moved')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('import: map columns, preview 20 rows, import, then roll back', async ({ page }) => {
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Import…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import parts' });
  const rows = ['Item,Num,Hue,Count'];
  for (let index = 0; index < 25; index++)
    rows.push(`E2E Import ${index},8${String(index).padStart(4, '0')},Red,2`);
  await dialog.getByLabel('Choose a .csv file').setInputFiles({
    name: 'e2e.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(rows.join('\n')),
  });
  await expect(dialog.getByText('0 of 25 rows are ready')).toBeVisible();
  await dialog.getByLabel('Column “Item”').selectOption('name');
  await dialog.getByLabel('Column “Num”').selectOption('design_id');
  await dialog.getByLabel('Column “Hue”').selectOption('color');
  await dialog.getByLabel('Column “Count”').selectOption('quantity');
  await expect(dialog.getByText('25 of 25 rows are ready')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: /first 20 rows/ })).toBeVisible();
  await expect(dialog.locator('tbody tr')).toHaveCount(20);
  await dialog.getByRole('button', { name: 'Import 25 rows' }).click();
  await expect(page.getByText(/Imported: 25 added/)).toBeVisible();

  page.once('dialog', (confirm) => void confirm.accept());
  await dialog.getByRole('button', { name: 'Roll back' }).first().click();
  await expect(page.getByText('Import rolled back')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByLabel('Search parts').fill('E2E Import');
  await expect(page.getByText('No parts found')).toBeVisible();
});

test('exports work', async ({ request }) => {
  const csv = await request.get('/api/export/csv');
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('name,design_id');
  const json = await request.get('/api/export/json');
  expect((await json.json()).format).toBe('lego-library-export');
});

test('duplicates dialog finds the sample duplicate and merges it', async ({ page }) => {
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name: 'Find duplicates' }).click();
  const dialog = page.getByRole('dialog', { name: 'Duplicate parts' });
  await expect(dialog).toContainText('#3001');
  page.once('dialog', (confirm) => void confirm.accept());
  await dialog.getByRole('button', { name: 'Merge into one' }).first().click();
  await expect(dialog.getByText('No duplicates')).toBeVisible();
});

test('custom part file: export it, then import it as a new part', async ({ page, request }) => {
  const created = await (
    await request.post('/api/parts', {
      data: {
        kind: 'custom',
        name: 'E2E Shared Part',
        category: 'Plates',
        color_id: 4,
        source: 'scratch_built',
        width_plates: 3,
        tags: [],
      },
    })
  ).json();
  const exported = await request.get(`/api/parts/${created.id}/export`);
  expect(exported.headers()['content-disposition']).toContain('attachment');
  await page.reload();
  await expect(page.getByRole('grid', { name: 'Parts table' })).toBeVisible();
  await page.getByLabel('Custom part file').setInputFiles({
    name: 'shared.json',
    mimeType: 'application/json',
    buffer: Buffer.from(await exported.text()),
  });
  await expect(page.getByText('Imported custom part "E2E Shared Part"')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Part details' })).toContainText(
    'Custom (version 1)',
  );
});
