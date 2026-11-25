import { expect, test, type Page } from '@playwright/test';
import { build } from 'esbuild';

async function fixture(page: Page, html: string): Promise<void> {
  await page.setContent(`<main>${html}</main>`);
  const module = await build({ entryPoints: ['apps/web/src/shell/pad-focus.ts'], bundle: true, write: false, format: 'iife', globalName: 'controls' });
  await page.addScriptTag({ content: module.outputFiles[0]!.text });
}

const press = (page: Page, command: 'previous' | 'next' | 'activate') => page.evaluate((cmd) => {
  const api = window as unknown as { controls: typeof import('../../apps/web/src/shell/pad-focus') };
  api.controls.padFocus(document.querySelector('main')!, cmd);
}, command);

test('travel the front window and status bar without entering a frame or reaching a covered control', async ({ page }) => {
  await fixture(page, `<header><button id="home">Open</button></header>
    <section class="window" data-window-id="old"><button>Background</button></section>
    <section class="window focused" data-window-id="launcher"><button hidden>Hidden</button>
    <button disabled>Opening</button><button tabindex="-1">Skip</button><details><summary>Members</summary><button>Folded away</button></details>
    <iframe tabindex="0" srcdoc="<button>Applet</button>"></iframe><input type="checkbox" id="member"></section>`);
  await press(page, 'next');
  await expect(page.locator('summary')).toBeFocused();
  await press(page, 'next');
  await expect(page.locator('#member[data-pad-focus]')).toBeFocused();
  await press(page, 'activate');
  await expect(page.locator('#member')).toBeChecked();
  await press(page, 'next');
  await expect(page.locator('#home')).toBeFocused();
  await press(page, 'previous');
  await expect(page.locator('#member')).toBeFocused();
});

test('confirm cannot click through the top question, or implicitly accept its first answer', async ({ page }) => {
  await fixture(page, `<button id="under">Underneath</button><section role="dialog" aria-modal="true"><button>Old question</button></section>
    <section role="dialog" aria-modal="true"><input type="checkbox" id="answer"></section><section role="dialog" aria-modal="true" hidden><button>Hidden</button></section>`);
  await page.locator('#under').focus();
  await press(page, 'activate');
  await expect(page.locator('#answer')).toBeFocused();
  await expect(page.locator('#answer')).not.toBeChecked();
  await press(page, 'previous');
  await expect(page.locator('#answer')).toBeFocused();
});

test('movement scrolls the focused stack control into view', async ({ page }) => {
  await fixture(page, `<div id="list" style="height:60px;overflow:auto"><button>Stack</button><div style="height:400px"></div><button id="open">Open all</button></div>`);
  await press(page, 'next');
  await press(page, 'next');
  await expect(page.locator('#open')).toBeFocused();
  expect(await page.locator('#list').evaluate((list) => list.scrollTop)).toBeGreaterThan(300);
});

test('controller reaches roving Settings tabs and changes select choices without a native picker', async ({ page }) => {
  await fixture(page, `<button role="tab" tabindex="0">General</button><button role="tab" tabindex="-1">Media</button>
    <select><option value="one">One</option><optgroup disabled><option>Unavailable</option></optgroup><option value="two">Two</option></select>
    <output></output>`);
  await page.locator('select').evaluate((el) => el.addEventListener('change', () => {
    document.querySelector('output')!.value = el.value;
  }));
  await press(page, 'next');
  await press(page, 'next');
  await expect(page.getByRole('tab', { name: 'Media' })).toBeFocused();
  await press(page, 'next');
  await press(page, 'activate');
  await expect(page.locator('output')).toHaveText('two');
  await press(page, 'activate');
  await expect(page.locator('output')).toHaveText('one');
});
