import { test, expect } from '@playwright/test';

test.describe('Navigation and static pages', () => {
  test('SPA routing works for all public routes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[placeholder="Search for services..."]')).toBeVisible({ timeout: 10000 });

    await page.goto('/add-service');
    await expect(page.locator('text=Add your service')).toBeVisible({ timeout: 5000 });

    await page.goto('/privacy');
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });

    await page.goto('/terms');
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
  });

  test('404 page for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible({ timeout: 5000 });
  });

  test('admin login page loads (lazy-loaded)', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('text=Spilno Admin')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('footer links work', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[placeholder="Search for services..."]')).toBeVisible({ timeout: 10000 });

    const privacyLink = page.locator('footer a[href="/privacy"]');
    if (await privacyLink.isVisible()) {
      await privacyLink.click();
      await expect(page).toHaveURL('/privacy');
    }
  });
});
