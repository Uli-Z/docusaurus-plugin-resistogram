import { test, expect } from '@playwright/test';

test('Landing page loads in Firefox', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('header')).toBeVisible();
});

test('Resistogramm page loads and shows table', async ({ page }) => {
  await page.goto('/docs/Resistogramm');
  await expect(page.locator('h1')).toContainText('Resistogramm');

  // Wait directly for a stable piece of content inside the table.
  // This confirms the entire component has loaded and rendered.
  const firstCell = page.locator('tbody tr:first-child td:first-child');
  await expect(firstCell).toContainText('Pen. G', { timeout: 15000 });
  await expect(firstCell).toBeVisible();
});
