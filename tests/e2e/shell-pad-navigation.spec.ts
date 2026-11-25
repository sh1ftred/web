import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';

const base = process.env.PLAYWRIGHT_BASE_URL ?? '';

async function controller(page: Page) {
  await page.addInitScript(() => {
    // Only the host has a native reader. Do not grant it to the preview's sealed frames.
    if (window !== window.top) return;
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
    const pad = { id: 'Preview controller', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, timestamp: 0 };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad, null, null, null] });
    window.addEventListener('test-pad-buttons', (event) => {
      const down = (event as CustomEvent<number[]>).detail;
      buttons.forEach((button, index) => {
        button.pressed = button.touched = down.includes(index);
        button.value = Number(button.pressed);
      });
      pad.timestamp = performance.now();
    });
  });
  const set = (...down: number[]) => page.evaluate(async (indices) => {
    window.dispatchEvent(new CustomEvent('test-pad-buttons', { detail: indices }));
    // Keep the sample stable across the reader's animation frame; no wall-clock sleep.
    await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
  }, down);
  const press = async (...down: number[]) => { await set(...down); await set(); };
  const moveTo = async (target: Locator) => {
    await expect(target).toBeVisible();
    // Navigate the real focus order rather than rely on a particular number of toolbar buttons.
    for (let steps = 0; steps < 64 && !await target.evaluate((el) => el === document.activeElement); steps++) await press(13);
    await expect(target).toBeFocused();
  };
  return { set, press, moveTo };
}

test('a controller opens a stack, leaves ordinary input with its applet and deliberately takes it back', async ({ page }) => {
  const pad = await controller(page);
  await page.goto(`${base}/app/?preview=1`);
  await pad.moveTo(page.getByRole('button', { name: 'Try the preview' }));
  await pad.press(0);
  await expect(page.getByRole('button', { name: 'Open an applet' })).toBeVisible();
  await pad.set();
  await pad.press(3); // Y: no need to cross the desktop toolbar to reach Stacks.
  const stacks = page.getByRole('list', { name: 'Stacks', exact: true });
  await expect(stacks.getByRole('heading')).toHaveText(['Basics', 'Live']);
  await pad.moveTo(stacks.getByRole('button', { name: 'Open 1 of the 2 in Basics, installing the rest' }));
  await pad.press(0);
  await pad.moveTo(page.getByRole('button', { name: 'Open this applet' }));
  await pad.press(0);

  const notes = page.getByRole('region', { name: 'Notes window' });
  const applets = page.getByRole('region', { name: 'Applets window' });
  const switcher = page.getByRole('dialog', { name: 'Controller switcher' });
  await expect(notes).toHaveClass(/\bfocused\b/);
  await expect(notes).toHaveAttribute('data-status', 'running');
  // Reading input from the outer page must still work when focus is inside a sealed frame.
  await page.frameLocator('iframe[data-window-id]').getByRole('button', { name: 'Open a profile' }).focus();
  await expect(page.locator('iframe[data-window-id]')).toBeFocused();
  await pad.set();
  // A real click inside the sandbox transfers browser focus as well as manager focus.
  await page.frameLocator('iframe[data-window-id]').first().locator('body').click({ position: { x: 2, y: 2 } });
  await pad.set();
  await pad.press(3);
  await pad.press(5);
  await pad.press(10); // One stick click belongs to the applet too.
  await expect(switcher).toHaveCount(0);
  await expect(applets).toHaveCount(0);
  await expect(notes).toHaveClass(/\bfocused\b/);

  await pad.press(10, 11);
  await expect(switcher).toBeVisible();
  await expect(notes).not.toHaveClass(/\bfocused\b/);
  await pad.moveTo(switcher.getByRole('button', { name: 'Notes', exact: true }));
  await pad.set(0);
  await expect(switcher).toBeVisible(); // A down is not a handoff into an applet with A held.
  await pad.set();
  await expect(switcher).toHaveCount(0);
  await expect(notes).toHaveClass(/\bfocused\b/);

  await pad.press(10, 11);
  await expect(switcher).toBeVisible();
  await pad.press(3);
  await expect(switcher).toHaveCount(0);
  await expect(applets.getByRole('tab', { name: 'Stacks' })).toHaveAttribute('aria-selected', 'true');
  await pad.press(10, 11);
  await expect(switcher).toBeVisible();
  await pad.press(4);
  await expect(switcher.getByRole('button', { name: 'Notes', exact: true })).toBeFocused();
  await pad.press(5);
  await expect(switcher.getByRole('button', { name: 'Applets', exact: true })).toBeFocused();
  await pad.press(1); // B dismisses; no window was closed or remounted.
  await expect(switcher).toHaveCount(0);
  await expect(notes).toHaveAttribute('data-status', 'running');
  await expect(applets).toHaveCount(1);

  await pad.press(10, 11);
  await pad.moveTo(switcher.getByRole('button', { name: 'Close Notes' }));
  await pad.press(0);
  await expect(notes).toHaveCount(0);
  await expect(switcher).toBeVisible();
});
