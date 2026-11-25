import { finalizeEvent, generateSecretKey } from 'nostr-tools';
import { expect, test } from './fixtures';

const key = generateSecretKey();
const event = finalizeEvent({ kind: 31971, created_at: 1_700_000_000, tags: [], content: 'Cached problem' }, key);
const relays = ['wss://nos.lol', 'wss://relay.routstr.com'];

test('the live desktop counts and lists each cached Outbox event once', async ({ page }) => {
  await page.routeWebSocket(/.*/, (socket) => socket.close());
  await page.addInitScript(({ event, relays }) => {
    const observed = Date.now();
    sessionStorage.setItem('kernl:outbox-tree-events:v2', JSON.stringify(relays.map((relay) => ({ event, relay, observed }))));
  }, { event, relays });
  await page.goto('/app/');
  await page.getByRole('listitem').filter({ hasText: 'Read-only' }).getByRole('button', { name: 'Choose' }).click();
  await page.getByRole('textbox', { name: 'Identity' }).fill(event.pubkey);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Cached events · 1' }).click();
  const panel = page.getByRole('dialog', { name: 'Cached events' });
  const entries = panel.getByRole('listitem');
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText(event.id);
  await expect(entries.first()).toContainText(relays.join(', '));
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

test('the compact preview menu distinguishes an unavailable cache from zero events', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app/?preview=1');
  await page.getByRole('button', { name: 'Try the preview' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Cached events · —' }).click();
  await expect(page.getByRole('dialog', { name: 'Cached events' })).toContainText('The Outbox cache is not available in this mode.');
});
