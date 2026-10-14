import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 375, height: 760 } });

test('works at phone width without sideways scrolling', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('grid', { name: 'Parts table' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Custom parts' }).click();
  await expect(page.getByText('View: Custom parts')).toBeVisible();

  await page.getByRole('button', { name: /^Open (?!menu)/ }).first().click();
  const panel = page.getByRole('complementary', { name: 'Part details' });
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(375);
  await page.getByRole('button', { name: 'Close panel' }).click();
});

test('every button and field has an accessible name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('grid', { name: 'Parts table' })).toBeVisible();
  const unnamed = await page.evaluate(() => {
    const bad: string[] = [];
    for (const element of document.querySelectorAll('button, input, select, textarea')) {
      const html = element as HTMLElement;
      const label =
        html.getAttribute('aria-label') ||
        html.textContent?.trim() ||
        (html.id && document.querySelector(`label[for="${html.id}"]`)?.textContent) ||
        html.closest('label')?.textContent;
      if (!label) bad.push(html.outerHTML.slice(0, 80));
    }
    return bad;
  });
  expect(unnamed).toEqual([]);
});
