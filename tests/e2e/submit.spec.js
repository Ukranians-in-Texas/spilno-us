import { test, expect } from '@playwright/test';

test.describe('Submit a listing', () => {
  test('shows validation errors for empty required fields', async ({ page }) => {
    await page.goto('/add-service');
    await expect(page.getByText('Add your service')).toBeVisible({ timeout: 10000 });

    await page.locator('button[type="submit"]', { hasText: 'Submit' }).click();

    await expect(page.getByText('Please select a category')).toBeVisible();
    await expect(page.getByText('Please enter your business name')).toBeVisible();
    await expect(page.getByText('Please enter a description in English')).toBeVisible();
    await expect(page.getByText('Please enter a description in Ukrainian')).toBeVisible();
    await expect(page.getByText('Please enter your email')).toBeVisible();
  });

  test('shows email format error', async ({ page }) => {
    await page.goto('/add-service');
    await expect(page.getByText('Add your service')).toBeVisible({ timeout: 10000 });

    await page.locator('input#email').fill('not-an-email');
    await page.locator('input#email').blur();
    await page.locator('button[type="submit"]', { hasText: 'Submit' }).click();

    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });

  test('successful submission shows thank-you message', async ({ page }) => {
    await page.route('**/api/submit-service', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/add-service');
    await expect(page.getByText('Add your service')).toBeVisible({ timeout: 10000 });

    const categoryInput = page.locator('input#category');
    await categoryInput.click();
    await categoryInput.fill('Plumbing');
    const option = page.locator('[role="option"]').first();
    await option.waitFor({ timeout: 3000 });
    await option.click();

    await page.locator('input#businessName').fill('Test Business');
    await page.locator('textarea#descriptionEn').fill('Test description in English for e2e testing.');
    await page.locator('textarea#descriptionUa').fill('Тестовий опис українською для тестування.');
    await page.locator('input#email').fill('test@example.com');

    await page.locator('input[type="checkbox"]').check({ force: true });

    await page.locator('button[type="submit"]', { hasText: 'Submit' }).click();

    await expect(page.getByText('Thank you!')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Your listing has been submitted and will appear after review.')).toBeVisible();
  });

  test('can navigate to add-service from homepage', async ({ page }) => {
    await page.route('**/api/services*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/');
    await expect(page.locator('input[placeholder="Search for services..."]')).toBeVisible({ timeout: 10000 });

    const addLink = page.locator('a[href="/add-service"]').first();
    await addLink.click();

    await expect(page).toHaveURL('/add-service');
    await expect(page.getByText('Add your service')).toBeVisible();
  });
});
