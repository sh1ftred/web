const CONTROLS = 'button, a[href], input, textarea, select, summary, [tabindex]';
const MODAL = '[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]';
const FRAME = '.window[data-window-id]';

type Movement = 'previous' | 'next' | 'activate';

function visible(element: HTMLElement): boolean {
  if (element.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
  // Closed details may keep layout boxes even for descendants they do not paint.
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (!parent.matches('details:not([open])')) continue;
    if (!parent.querySelector(':scope > summary')?.contains(element)) return false;
  }
  return element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible';
}

function targets(root: HTMLElement): HTMLElement[] {
  // Shell.svelte renders its stacked questions in paint order, above Desktop's sheet.
  const modal = [...root.querySelectorAll<HTMLElement>(MODAL)].filter(visible).pop();
  const focused = root.querySelector(`${FRAME}.focused`);
  const controls = [...(modal ?? root).querySelectorAll<HTMLElement>(CONTROLS)].filter((element) =>
    !element.matches('iframe, .resize, :disabled, [tabindex="-1"]:not([role="tab"])') &&
    !element.closest('[aria-disabled="true"]') && visible(element));
  if (modal) return controls;
  return [...controls.filter((el) => focused && el.closest(FRAME) === focused), ...controls.filter((el) => !el.closest(FRAME))];
}

function highlight(element: HTMLElement): void {
  if (!element.hasAttribute('data-pad-focus')) {
    element.setAttribute('data-pad-focus', '');
    element.addEventListener('blur', () => element.removeAttribute('data-pad-focus'), { once: true });
  }
  element.focus({ preventScroll: true });
  element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
}

function activate(element: HTMLElement): void {
  if (element.tagName !== 'SELECT') {
    element.click();
    return;
  }
  // Untrusted clicks cannot operate a native picker. Step through its choices instead.
  const select = element as HTMLSelectElement;
  const options = Array.from(select.options);
  for (let step = 1; step < options.length + 1; step++) {
    const index = (select.selectedIndex + step) % options.length;
    if (index === select.selectedIndex || options[index]!.closest('[disabled], [hidden]')) continue;
    select.selectedIndex = index;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
}

/** Move among host controls in the front sheet or window, or press the currently focused control. */
export function padFocus(root: HTMLElement, command: Movement): void {
  const items = targets(root);
  if (!items.length) return;
  const index = items.findIndex((el) => el === root.ownerDocument.activeElement);
  if (command === 'activate' && index !== -1) {
    activate(items[index]!);
    return;
  }
  const next = command === 'previous' ? (index <= 0 ? items.length - 1 : index - 1) : (index + 1) % items.length;
  highlight(items[next]!);
}
