import { test, expect } from '@playwright/test';

const MOCK_SERVICES = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Test Plumbing Service',
    description: 'Professional plumbing repairs.',
    category: 'Plumbing',
    phone: '555-0100',
    email: 'plumber@test.com',
    approved: true,
    featured: true,
    featured_order: 1,
    submitted_at: '2026-01-01T00:00:00Z',
    submittedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    title: 'Test Cleaning Service',
    description: 'Home and office cleaning.',
    category: 'Cleaning',
    phone: '555-0200',
    email: 'cleaner@test.com',
    approved: true,
    featured: false,
    submitted_at: '2026-01-02T00:00:00Z',
    submittedAt: '2026-01-02T00:00:00Z',
  },
];

function mockServicesAPI(page) {
  return page.route('**/api/services*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SERVICES),
    });
  });
}

test.describe('Browse listings', () => {
  test('homepage loads and shows service cards', async ({ page }) => {
    await mockServicesAPI(page);
    await page.goto('/');
    await expect(page.locator('input[placeholder="Search for services..."]')).toBeVisible();
    await expect(page.getByText('Test Plumbing Service')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Test Cleaning Service')).toBeVisible();
  });

  test('search filters listings', async ({ page }) => {
    await mockServicesAPI(page);
    await page.goto('/');
    await expect(page.getByText('Test Plumbing Service')).toBeVisible({ timeout: 10000 });

    const searchInput = page.locator('input[placeholder="Search for services..."]');
    await searchInput.fill('Plumbing');
    await expect(page.getByText('Test Plumbing Service')).toBeVisible();
    await expect(page.getByText('Test Cleaning Service')).not.toBeVisible();

    await searchInput.fill('xyznonexistent');
    await expect(page.getByText('Test Plumbing Service')).not.toBeVisible();
    await expect(page.getByText('Test Cleaning Service')).not.toBeVisible();

    await searchInput.clear();
    await expect(page.getByText('Test Plumbing Service')).toBeVisible();
    await expect(page.getByText('Test Cleaning Service')).toBeVisible();
  });

  test('language toggle switches UI text', async ({ page }) => {
    await mockServicesAPI(page);
    await page.goto('/');
    await expect(page.locator('input[placeholder="Search for services..."]')).toBeVisible({ timeout: 10000 });

    const langButton = page.locator('button', { hasText: /^UA$/ });
    if (await langButton.isVisible()) {
      await langButton.click();
      await expect(page.locator('input[placeholder*="Пошук"]')).toBeVisible({ timeout: 3000 });

      const enButton = page.locator('button', { hasText: /^EN$/ });
      await enButton.click();
      await expect(page.locator('input[placeholder="Search for services..."]')).toBeVisible({ timeout: 3000 });
    }
  });
});
