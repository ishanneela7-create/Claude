import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

async function openNewPart(page: Page, kind: 'Official part' | 'Custom part') {
  await page.getByRole('button', { name: 'New part' }).click();
  await page.getByRole('menuitem', { name: kind }).click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('grid', { name: 'Parts table' })).toBeVisible();
});

test('creates an official part and shows validation errors', async ({ page }) => {
  await openNewPart(page, 'Official part');
  await page.getByRole('button', { name: 'Create part' }).click();
  await expect(page.getByText('Name is required')).toBeVisible();
  await expect(page.getByText('Design id is required')).toBeVisible();

  await page.getByLabel('Name', { exact: true }).fill('E2E Test Brick');
  await page.getByLabel('Design id').fill('99001');
  await page.getByLabel('Color', { exact: true }).selectOption({ label: 'Red' });
  await page.getByLabel('Quantity').fill('7');
  await page.getByLabel('Tags').fill('e2e');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Create part' }).click();

  await expect(page.getByRole('complementary', { name: 'Part details' })).toContainText('E2E Test Brick');
  await page.getByLabel('Search parts').fill('E2E Test');
  await expect(page.getByRole('button', { name: /Open E2E Test Brick, Red/ })).toBeVisible();
});

test('edits a part, then undoes and redoes the edit', async ({ page }) => {
  await page.getByLabel('Search parts').fill('E2E Test');
  await page.getByRole('button', { name: /Open E2E Test Brick/ }).click();
  await page.keyboard.press('e');
  await page.getByLabel('Quantity').fill('21');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('complementary', { name: 'Part details' })).toContainText('21');

  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(page.getByRole('complementary', { name: 'Part details' })).toContainText('7');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('complementary', { name: 'Part details' })).toContainText('21');
});

test('custom part builder: create, edit the design (new version), view old version', async ({ page }) => {
  await openNewPart(page, 'Custom part');
  await page.getByLabel('Name', { exact: true }).fill('E2E Custom Gear');
  await page.getByLabel('Color', { exact: true }).selectOption({ label: 'Blue' });
  await page.getByLabel('Width in studs').fill('4');
  await page.getByLabel('Depth in studs').fill('2');
  await page.getByLabel('Height in plates').fill('3');
  await page.getByLabel('Stud pattern').fill('2 x 4 grid');
  await page.getByLabel('Material').selectOption('PETG');
  await page.getByRole('button', { name: 'Create part' }).click();

  const panel = page.getByRole('complementary', { name: 'Part details' });
  await expect(panel).toContainText('Custom (version 1)');
  await expect(panel).toContainText('4 x 2 x 3');

  await page.keyboard.press('e');
  await page.getByLabel('Stud pattern').fill('ring of 8');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(panel).toContainText('Custom (version 2)');
  await expect(panel.getByRole('list', { name: 'Version history' })).toContainText('Version 1');

  await panel.getByRole('button', { name: 'View' }).click();
  await expect(panel).toContainText('old version');
  await expect(panel.getByRole('button', { name: 'Edit' })).toHaveCount(0);
});

test('uploads a photo to a part (resized by the server)', async ({ page, request }) => {
  await request.post('/api/parts', {
    data: { kind: 'custom', name: 'E2E Photo Part', category: 'Bricks', color_id: 1, source: 'other', tags: [] },
  });
  await page.reload();
  await page.getByLabel('Search parts').fill('E2E Photo Part');
  await page.getByRole('button', { name: /Open E2E Photo Part/ }).click();
  const png = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#1256b8' } }).png().toBuffer();
  await page.getByLabel(/Add photos/).setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('img', { name: /Photo 1 of 1/ })).toBeVisible();
  const served = await request.get((await page.getByRole('img', { name: /Photo 1 of 1/ }).getAttribute('src')) ?? '');
  expect(served.status()).toBe(200);
  expect(Number(served.headers()['content-length'])).toBeGreaterThan(0);
});

test('bulk edit moves several parts at once', async ({ page }) => {
  await page.getByLabel('Search parts').fill('cat:plates');
  await page.getByRole('checkbox', { name: /^Select/ }).first().check();
  await page.getByRole('checkbox', { name: /^Select/ }).nth(1).check();
  await page.getByRole('button', { name: 'Edit selected…' }).click();
  await page.getByLabel('Add tags (comma separated)').fill('bulk-e2e');
  await page.getByRole('button', { name: /^Apply to 2 parts/ }).click();
  await expect(page.getByText('Updated 2 parts')).toBeVisible();
  await page.getByLabel('Search parts').fill('tag:bulk-e2e');
  await expect(page.getByText('2 parts')).toBeVisible();
});
