import { ChatPage } from './pages/chat';
import { test, expect } from '@playwright/test';

test.describe('chat activity with reasoning', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.createNewChat();
  });

  test('send user message and generate response with reasoning', async () => {
    await chatPage.sendUserMessage('Why is the sky blue?');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toBe("It's just blue duh!");

    expect(assistantMessage.reasoning).toBe(
      'The sky is blue because of rayleigh scattering!',
    );
  });

  test('toggle reasoning visibility', async () => {
    await chatPage.sendUserMessage('Why is the sky blue?');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    const reasoningElement =
      assistantMessage.element.getByTestId('message-reasoning');
    expect(reasoningElement).toBeVisible();

    await assistantMessage.toggleReasoningVisibility();
    await expect(reasoningElement).not.toBeVisible();

    await assistantMessage.toggleReasoningVisibility();
    await expect(reasoningElement).toBeVisible();
  });

  test('edit message and resubmit', async () => {
    await chatPage.sendUserMessage('Why is the sky blue?');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    const reasoningElement =
      assistantMessage.element.getByTestId('message-reasoning');
    expect(reasoningElement).toBeVisible();

    const userMessage = await chatPage.getRecentUserMessage();

    await userMessage.edit('Why is grass green?');
    await chatPage.isGenerationComplete();

    const updatedAssistantMessage = await chatPage.getRecentAssistantMessage();

    expect(updatedAssistantMessage.content).toBe("It's just green duh!");

    expect(updatedAssistantMessage.reasoning).toBe(
      'Grass is green because of chlorophyll absorption!',
    );
  });
});

test.describe('Chat reasoning UI tests', () => {
  test('should display reasoning steps for memory search', async ({ page }) => {
    // Go to the main chat page
    await page.goto('/');
    
    // Type a message that will trigger memory search reasoning
    await page.getByRole('textbox').fill('search my memories for silicon valley');
    
    // Submit the message
    await page.getByRole('textbox').press('Enter');
    
    // Wait for reasoning component to appear
    const reasoningElement = await page.waitForSelector('[data-testid="message-reasoning"]', { 
      timeout: 30000
    });
    
    expect(reasoningElement).toBeTruthy();
    
    // Check reasoning content
    const reasoningText = await reasoningElement.innerText();
    expect(reasoningText).toContain('memory search');
  });
  
  test('should toggle reasoning visibility when clicking toggle button', async ({ page }) => {
    // Go to the main chat page
    await page.goto('/');

    // Type a message that will trigger memory search
    await page.getByRole('textbox').fill('find memories about programming');
    
    // Submit the message
    await page.getByRole('textbox').press('Enter');

    // Wait for the reasoning component to appear
    await page.waitForSelector('[data-testid="message-reasoning"]', { timeout: 30000 });
    
    // Verify reasoning is visible initially
    const reasoningVisible = await page.locator('[data-testid="message-reasoning"]').isVisible();
    expect(reasoningVisible).toBe(true);
    
    // Click the toggle button
    await page.getByTestId('message-reasoning-toggle').click();
    
    // Verify reasoning is hidden after toggle
    await page.waitForSelector('[data-testid="message-reasoning"]', { 
      state: 'hidden',
      timeout: 5000 
    });
    
    // Click toggle again to show reasoning
    await page.getByTestId('message-reasoning-toggle').click();
    
    // Verify reasoning is visible again
    const reasoningVisibleAgain = await page.locator('[data-testid="message-reasoning"]').isVisible();
    expect(reasoningVisibleAgain).toBe(true);
  });
});
