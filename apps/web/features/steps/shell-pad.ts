import { After, Given, Then, When } from 'quickpickle';
import { expect, vi } from 'vitest';
import { installShellPad, type ShellPadCommand } from '../../src/shell/shell-pad.ts';

const buttons = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'select', 'menu', 'L3', 'R3', 'up', 'down', 'left', 'right'];

function padPage() {
  let words: string[] = [];
  let focused = true;
  let mode = 'standard';
  let applet = false;
  let scope = 0;
  let frame: (() => void) | undefined;
  const commands: ShellPadCommand[] = [];
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible', hasFocus: () => focused });
  const page = Object.assign(new EventTarget(), {
    document: doc,
    navigator: { getGamepads() {
      expect(focused && doc.visibilityState === 'visible').toBe(true);
      if (mode === 'denied') throw new Error('reader denied');
      return [null, {
        mapping: mode, index: 1, id: 'test', connected: mode !== 'disconnected',
        axes: [Number(words.includes('tilt-right')) - Number(words.includes('tilt-left')), Number(words.includes('tilt-down')) - Number(words.includes('tilt-up')) - Number(words.includes('slight-up')) * 0.5],
        buttons: buttons.map((word) => ({ pressed: words.includes(word) })),
      }];
    } },
    requestAnimationFrame(callback: () => void) { expect(frame).toBeUndefined(); frame = callback; return 0; },
    cancelAnimationFrame() { frame = undefined; },
  });
  vi.stubGlobal('window', page);
  const stop = installShellPad({ run: (command) => commands.push(command), appletOwns: () => applet, scope: () => scope });
  function sample() {
    const scheduled = frame;
    frame = undefined;
    scheduled?.();
  }
  return {
    commands, stop, polling: () => frame !== undefined,
    prompt() { scope++; },
    own(value: boolean) { applet = value; },
    blurSilently() { focused = false; },
    state(value: string) {
      if (value === 'visible' || value === 'hidden') {
        doc.visibilityState = value;
        doc.dispatchEvent(new Event('visibilitychange'));
      } else {
        focused = value === 'focused';
        page.dispatchEvent(new Event(focused ? 'focus' : 'blur'));
      }
    },
    reader(value: string) {
      mode = value;
      page.dispatchEvent(new Event(value === 'disconnected' ? 'gamepaddisconnected' : 'gamepadconnected'));
      if (value !== 'standard') sample();
    },
    samples(sequence: string) {
      for (const snapshot of sequence.split(', ')) {
        words = snapshot.split('+');
        sample();
      }
    },
  };
}

interface PadWorld { shellPad: ReturnType<typeof padPage> }
Given('a page reading a standard shell controller', (w: PadWorld) => { w.shellPad = padPage(); });
When('its controller samples are {string}', (w: PadWorld, sequence: string) => w.shellPad.samples(sequence));
When('its applet owns the controller', (w: PadWorld) => w.shellPad.own(true));
When('a new controller prompt arrives', (w: PadWorld) => w.shellPad.prompt());
When('its shell owns the controller', (w: PadWorld) => w.shellPad.own(false));
When('the controller page is {word}', (w: PadWorld, state: string) => w.shellPad.state(state));
When('its controller reader becomes {string}', (w: PadWorld, value: string) => w.shellPad.reader(value));
When('the shell controller reader stops', (w: PadWorld) => w.shellPad.stop());
Then('the controller is not polling', (w: PadWorld) => expect(w.shellPad.polling()).toBe(false));
Then('the controller sent nothing', (w: PadWorld) => expect(w.shellPad.commands).toEqual([]));
Then('the controller sent {string}', (w: PadWorld, commands: string) => expect(w.shellPad.commands).toEqual(commands.split(', ')));
After((w: PadWorld) => {
  if (!w.shellPad) return;
  w.shellPad.stop();
  vi.unstubAllGlobals();
});
When('the controller page loses focus before the browser sends blur', (w: PadWorld) => w.shellPad.blurSilently());
Then('installing the shell controller without a native reader is harmless', () => {
  const options = { run: vi.fn(), appletOwns: () => false };
  try {
    vi.stubGlobal('window', undefined);
    installShellPad(options)();
    vi.stubGlobal('window', { navigator: {} });
    installShellPad(options)();
    expect(options.run).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
