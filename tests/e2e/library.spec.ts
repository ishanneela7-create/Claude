import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('grid', { name: 'Parts table' })).toBeVisible();
  await expect(page.getByText(/\d+ parts$/)).toBeVisible();
});

test('shows sample data with swatches that screen readers can read', async ({ page }) => {
  await expect(page.getByRole('button', { name: /^Open Brick 1 x 1/ }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Grid view' }).click();
  await expect(page.getByText(/^Color: /).first()).toBeAttached();
});

test('search operators filter the list as you type', async ({ page, request }) => {
  const search = page.getByLabel('Search parts');
  const customCount = (
    (await (await request.get('/api/parts?kind=custom')).json()) as { total: number }
  ).total;
  await search.fill('custom:true');
  await expect(page.getByText(`${customCount} parts`, { exact: true })).toBeVisible();
  await search.fill('color:red cat:bricks');
  await expect(page.getByRole('button', { name: /Open Brick 2 x 4, Red/ }).first()).toBeVisible();
  await search.fill('zzzzzzzz');
  await expect(page.getByText('No parts found')).toBeVisible();
  await search.fill('');
});

test('switches between table and grid, and density', async ({ page }) => {
  await page.getByRole('button', { name: 'Grid view' }).click();
  await expect(page.getByRole('list', { name: 'Parts grid' })).toBeVisible();
  await page.getByRole('button', { name: 'Table view' }).click();
  await page.getByLabel('Density').selectOption('compact');
  await expect(page.getByRole('grid', { name: 'Parts table' })).toBeVisible();
  await page.getByLabel('Density').selectOption('normal');
});

test('groups parts and collapses a group', async ({ page }) => {
  await page.getByLabel('Group by').selectOption('category');
  const header = page.getByRole('row').getByRole('button', { name: /^Bricks/ });
  await expect(header).toHaveAttribute('aria-expanded', 'true');
  await header.click();
  await expect(header).toHaveAttribute('aria-expanded', 'false');
  await page.getByLabel('Group by').selectOption('');
});

test('smart views filter the list', async ({ page, request }) => {
  const customCount = (
    (await (await request.get('/api/parts?kind=custom')).json()) as { total: number }
  ).total;
  await page.getByRole('button', { name: 'Custom parts' }).click();
  await expect(page.getByText(`${customCount} parts`, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear all' }).click();
});

test('keyboard shortcuts work', async ({ page }) => {
  await page.keyboard.press('/');
  await expect(page.getByLabel('Search parts')).toBeFocused();
  await page.keyboard.press('Escape');
  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('n');
  await expect(page.getByRole('complementary', { name: 'New official part' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary', { name: 'New official part' })).toHaveCount(0);
  await page.keyboard.press('?');
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('dark mode toggles and follows the system by default', async ({ page }) => {
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  await page.getByRole('button', { name: /^Theme: system/ }).click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: /^Theme: light/ }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: /^Theme: dark/ }).click();
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
});
