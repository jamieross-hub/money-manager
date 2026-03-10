import { test, expect, type Page } from '@playwright/test';

test.describe('Transaction Form (Mobile)', () => {
  test.beforeEach(async ({ page }) => {
    // Set to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    // Navigate to the app (using baseURL from config)
    await page.goto('/');
    
    // Wait for either the sign-in page or the dashboard
    await page.waitForURL(/.*(sign-in|dashboard).*/);
    
    // Continue as Guest (Offline Mode) if we are on the sign-in page
    if (page.url().includes('sign-in')) {
      const guestButton = page.getByRole('button', { name: /Use Offline/i });
      await expect(guestButton).toBeVisible({ timeout: 10000 });
      await guestButton.click();
    }
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/.*dashboard.*/);
  });

  test('should add a simple expense transaction', async ({ page }) => {
    // Click Add button in the footer - it's a button with span "Add"
    const addButton = page.locator('button').filter({ hasText: 'Add' });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Verify Add Transaction form is open
    await expect(page.getByRole('heading', { name: /Transaction/i })).toBeVisible();

    // Fill in the amount
    const amountInput = page.getByPlaceholder('0.00').first();
    await amountInput.fill('100');
    await amountInput.blur();
    
    // Fill Notes (Description)
    const notesInput = page.getByPlaceholder('Add any additional notes...');
    await expect(notesInput).toBeVisible();
    await notesInput.fill('Test Transaction');

    // Select Category (on mobile it opens a sheet)
    await page.getByText(/Select a category/i).click();
    
    // Wait for category sheet to open
    // We'll search for 'Food' or just pick the first list item
    const categorySearch = page.getByPlaceholder('Search categories...');
    await expect(categorySearch).toBeVisible();
    
    const firstCategory = page.locator('mat-list-item').first();
    await expect(firstCategory).toBeVisible();
    await firstCategory.click();

    // Verify category is selected (the placeholder "Select a category" should be gone)
    await expect(page.getByText(/Select a category/i)).not.toBeVisible();

    // Save Transaction - The button is in the header, with tooltip "Save Transaction" or icon "check"
    // In mobile, it might be easier to target by mat-icon 'check'
    const saveButton = page.locator('app-common-header button').filter({ has: page.locator('mat-icon:text("check")') });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // After saving, the form should close
    await expect(page.getByText(/Add Transaction/i)).not.toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    // Click Add button in the footer
    await page.locator('button').filter({ hasText: /^Add$/ }).click();

    // Click Save without filling anything
    const saveButton = page.locator('app-common-header button').filter({ has: page.locator('mat-icon:text("check")') });
    await saveButton.click();

    // Check for validation errors
    await expect(page.getByText('Category is required')).toBeVisible();
    // Amount error in HTML: <p class="text-red-500 text-sm mt-1">{{ getAmountError() }}</p>
    // Assuming getAmountError() returns some specific text
    await expect(page.locator('p.text-red-500')).toBeVisible();
  });
});

test.describe('Transaction Form (Desktop)', () => {
    test.beforeEach(async ({ page }) => {
      // Set to desktop viewport
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto('/');
      
      // Wait for either the sign-in page or the dashboard
      await page.waitForURL(/.*(sign-in|dashboard).*/);
      
      // Continue as Guest (Offline Mode) if we are on the sign-in page
      if (page.url().includes('sign-in')) {
        const guestButton = page.getByRole('button', { name: /Use Offline/i });
        await expect(guestButton).toBeVisible({ timeout: 10000 });
        await guestButton.click();
      }
      
      await expect(page).toHaveURL(/.*dashboard.*/);
    });
  
    test('should add a transaction via mat-select category', async ({ page }) => {
      // Desktop footer also has an Add button
      const addButton = page.locator('button').filter({ hasText: /^Add$/ });
      await addButton.click();
  
      const amountInput = page.getByPlaceholder('0.00').first();
      await amountInput.fill('250.75');
  
      // Desktop uses mat-select (line 83 of HTML)
      const categorySelect = page.locator('mat-select[formControlName="categoryId"]');
      await categorySelect.click();
      
      // Pick an option
      const option = page.locator('mat-option').first();
      await option.click();
  
      const saveButton = page.locator('app-common-header button').filter({ has: page.locator('mat-icon:text("check")') });
      await saveButton.click();
      
      await expect(page.getByText(/Add Transaction/i)).not.toBeVisible();
    });
});
