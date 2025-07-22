import path from 'path';
import { expect, test as setup } from '@playwright/test';
import { ChatPage } from './pages/chat';

const reasoningFile = path.join(
  __dirname,
  '../playwright/.reasoning/session.json',
);

setup('switch to reasoning model', async ({ page }) => {
  const chatPage = new ChatPage(page);
  await chatPage.createNewChat();

  await chatPage.chooseModelFromSelector('chat-model-reasoning');

  await expect(chatPage.getSelectedModel()).resolves.toEqual('Reasoning model');

  await page.waitForTimeout(1000);
  await page.context().storageState({ path: reasoningFile });
});

// Set up authentication for tests
setup('authenticate', async ({ page }) => {
  // Skip authentication setup if this is a CI environment
  if (process.env.CI) {
    console.log('CI environment detected, skipping authentication setup');
    return;
  }
  
  // Go to the login page
  await page.goto('/login');

  // Check if we're already logged in by looking for chat UI elements
  const alreadyLoggedIn = await page.getByRole('textbox').isVisible()
    .catch(() => false);

  if (alreadyLoggedIn) {
    console.log('Already logged in, skipping authentication');
    return;
  }

  // Use test credentials - these should be provided via environment variables
  const testEmail = process.env.TEST_USER_EMAIL || 'test@example.com';
  const testPassword = process.env.TEST_USER_PASSWORD || 'password123';

  // Fill login form
  await page.getByLabel('Email').fill(testEmail);
  await page.getByLabel('Password').fill(testPassword);

  // Submit the form
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for navigation to complete after login
  await page.waitForURL('/**');

  // Verify we're logged in by checking for the chat input
  await expect(page.getByRole('textbox')).toBeVisible();

  // Store authentication state
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
