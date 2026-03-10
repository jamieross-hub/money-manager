import { test, expect, type Page } from '@playwright/test';

test.describe('Transaction Form (Mobile)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    // Set to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    // Navigate to the app
    await page.goto('/');
    
    // Wait for either the sign-in page or the dashboard
    await page.waitForURL(/.*(sign-in|dashboard).*/, { timeout: 30000 });
    
    // Continue as Guest (Offline Mode) if we are on the sign-in page
    if (page.url().includes('sign-in')) {
      const guestButton = page.getByRole('button', { name: /Use Offline/i });
      await expect(guestButton).toBeVisible({ timeout: 15000 });
      await guestButton.click();
    }
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 30000 });
    // Wait for the app to settle
    await page.waitForLoadState('networkidle');
  });

  test('should add a simple expense transaction', async ({ page }) => {
    // Click Add button in the footer
    const addButton = page.locator('app-footer button:has(.add-button-box)');
    await expect(addButton).toBeVisible({ timeout: 15000 });
    await addButton.click();

    // Verify Add Transaction form is open
    await expect(page.getByRole('heading', { name: /Transaction/i })).toBeVisible({ timeout: 10000 });

    // Fill in the amount
    const amountInput = page.getByPlaceholder('0.00').first();
    await expect(amountInput).toBeVisible();
    await amountInput.fill('100');
    await amountInput.blur();
    
    // Fill Notes (Description)
    const notesInput = page.getByPlaceholder('Add any additional notes...');
    await notesInput.fill('Test Transaction');

    // Select Category - click the container div
    await page.locator('div').filter({ hasText: /^Select a category$/ }).first().click();
    
    // Wait for category sheet/search
    const categorySearch = page.getByPlaceholder('Search categories...');
    await expect(categorySearch).toBeVisible({ timeout: 10000 });
    
    // Pick the first one
    const firstCategory = page.locator('mat-list-item').first();
    await expect(firstCategory).toBeVisible();
    await firstCategory.click();

    // Save Transaction
    const saveButton = page.locator('app-common-header button').filter({ has: page.locator('mat-icon:text("check")') });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // After saving, the form should close
    await expect(page.getByRole('heading', { name: /Transaction/i })).not.toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    const addButton = page.locator('app-footer button:has(.add-button-box)');
    await addButton.click();

    // Click Save without filling anything
    const saveButton = page.locator('app-common-header button').filter({ has: page.locator('mat-icon:text("check")') });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Check for validation errors
    await expect(page.getByText('Category is required')).toBeVisible();
  });

  test('should add a transaction with category split', async ({ page }) => {
    const addButton = page.locator('app-footer button:has(.add-button-box)');
    await addButton.click();

    // Verify Add Transaction form is open
    await expect(page.getByRole('heading', { name: /Transaction/i })).toBeVisible();

    // Fill in the amount
    const amountInput = page.getByPlaceholder('0.00').first();
    await amountInput.fill('1000');
    await amountInput.blur();

    // Toggle "Split by Category"
    const splitToggle = page.locator('mat-slide-toggle[formcontrolname="isCategorySplit"]');
    await expect(splitToggle).toBeVisible();
    await splitToggle.click();

    // Wait for Category Split Dialog
    await expect(page.getByText('Split Transaction by Category')).toBeVisible({ timeout: 10000 });

    // First split
    await page.locator('mat-dialog-content mat-select').first().click();
    // Use option explicitly
    await page.locator('mat-option').first().click();
    await page.locator('input[formControlName="amount"]').first().fill('600');

    // Second split
    await page.getByRole('button', { name: /Add Another Split/i }).click();
    await page.locator('mat-dialog-content mat-select').nth(1).click();
    await page.locator('mat-option').nth(1).click();
    await page.locator('input[formControlName="amount"]').nth(1).fill('400');

    // Save Splits
    await page.getByRole('button', { name: 'Save Splits' }).click();

    // Verify summary is shown
    await expect(page.getByText('Category Splits')).toBeVisible();

    // Save Transaction
    const saveButton = page.locator('app-common-header button').filter({ has: page.locator('mat-icon:text("check")') });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // Form should close
    await expect(page.getByRole('heading', { name: /Transaction/i })).not.toBeVisible();
  });
});

test.describe('Transaction Form (Desktop)', () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/');
      await page.waitForURL(/.*(sign-in|dashboard).*/);
      
      if (page.url().includes('sign-in')) {
        await page.getByRole('button', { name: /Use Offline/i }).click();
      }
      
      await expect(page).toHaveURL(/.*dashboard.*/);
      await page.waitForLoadState('networkidle');
    });
  
    test('should add a transaction via mat-select category', async ({ page }) => {
      const addButton = page.locator('app-footer button:has(.add-button-box)');
      await expect(addButton).toBeVisible({ timeout: 15000 });
      await addButton.click();
  
      const amountInput = page.getByPlaceholder('0.00').first();
      await amountInput.fill('250.75');
  
      const categorySelect = page.locator('mat-select[formControlName="categoryId"]');
      await expect(categorySelect).toBeVisible();
      await categorySelect.click();
      await page.locator('mat-option').first().click();
  
      const saveButton = page.locator('app-common-header button').filter({ has: page.locator('mat-icon:text("check")') });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();
      
      await expect(page.getByRole('heading', { name: /Transaction/i })).not.toBeVisible();
    });
});
