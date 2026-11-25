/** Commands the desktop understands; an applet's own button bindings are independent. */
export type ShellPadCommand = 'home' | 'previous' | 'next' | 'activate' | 'back' | 'previous-window' | 'next-window' | 'stacks';

interface ShellPadOptions {
  appletOwns(): boolean;
  scope?(): unknown;
  run(command: ShellPadCommand): void;
}

const bindings = [
  [12, 'previous'], [14, 'previous'], [13, 'next'], [15, 'next'],
  [4, 'previous-window'], [5, 'next-window'], [3, 'stacks'], [1, 'back'], [0, 'activate'],
] as const;

function neutral(pad: Gamepad): boolean {
  return !pad.buttons.some((button) => button.pressed) && pad.axes.every((axis) => Math.abs(axis) < 0.4);
}

function controllerEdges() {
  let owner: boolean | undefined;
  let surface: unknown;
  let armed = false;
  let pendingActivate = false;
  let previous = new Set<ShellPadCommand>();
  let stick: 'previous' | 'next' | undefined;
  return (pad: Gamepad, applet: boolean, scope: unknown): ShellPadCommand | undefined => {
    if (owner !== applet || scope !== surface) {
      surface = scope;
      owner = applet;
      armed = false;
    }
    if (!armed) {
      armed = neutral(pad);
      pendingActivate = false;
      previous.clear();
      stick = undefined;
      return;
    }
    const left = pad.buttons[10]?.pressed;
    const right = pad.buttons[11]?.pressed;
    if (left && right) {
      // The next frame may already be showing a completely different shell surface.
      armed = false;
      return 'home';
    }
    if (applet) return;
    const [x = 0, y = 0] = pad.axes;
    const axis = Math.abs(x) > Math.abs(y) ? x : y;
    if (Math.abs(axis) >= 0.65) stick = axis < 0 ? 'previous' : 'next';
    else if (Math.abs(axis) < 0.4) stick = undefined;
    const pressed = new Set<ShellPadCommand>();
    if (stick) pressed.add(stick);
    for (const [index, command] of bindings) if (pad.buttons[index]?.pressed) pressed.add(command);
    // Count ALL edges as seen. A simultaneous direction and A must not activate the newly highlighted item.
    const edge = [...pressed].find((command) => !previous.has(command));
    previous = pressed;
    // Confirm on release: the applet that receives focus must never inherit a held A.
    if (edge === 'activate' && pressed.size === 1 && !left && !right) pendingActivate = true;
    if (pressed.size > (pressed.has('activate') ? 1 : 0) || left || right) pendingActivate = false;
    if (pendingActivate && pressed.size === 0) {
      pendingActivate = false;
      return neutral(pad) ? 'activate' : undefined;
    }
    return edge === 'activate' ? undefined : edge;
  };
}

/**
 * Read a standard controller for shell navigation without redirecting normal applet input (D-074).
 * @param options - Window manager ownership and the shell command handler.
 * @returns Disconnect listeners and cancel the pending sample.
 * @example
 * ```ts
 * const stop = installShellPad({ appletOwns: () => windows.windows.some(w => w.focused), run });
 * ```
 */
export function installShellPad(options: ShellPadOptions): () => void {
  if (typeof window === 'undefined' || typeof window.navigator.getGamepads !== 'function') return () => {};
  const page = window;
  const doc = page.document;
  let frame: number | undefined;
  let stopped = false;
  let device: { index: number; id: string } | undefined;
  let sample = controllerEdges();
  const active = () => doc.visibilityState === 'visible' && doc.hasFocus();
  function schedule(): void {
    if (!stopped && frame === undefined && active()) frame = page.requestAnimationFrame(poll);
  }
  function poll(): void {
    frame = undefined;
    if (!active()) { device = undefined; return; }
    let pads: (Gamepad | null)[];
    try { pads = page.navigator.getGamepads(); } catch { device = undefined; return; }
    const pad = pads.find((item) => item?.connected && item.mapping === 'standard');
    if (!pad) { device = undefined; return; } // The next connection event wakes the reader.
    if (device?.index !== pad.index || device.id !== pad.id) {
      device = { index: pad.index, id: pad.id };
      sample = controllerEdges();
    }
    const command = sample(pad, options.appletOwns(), options.scope?.());
    if (command) options.run(command);
    schedule();
  }
  function refresh(): void {
    if (frame !== undefined) page.cancelAnimationFrame(frame);
    frame = undefined;
    device = undefined;
    schedule();
  }
  const events = ['focus', 'blur', 'gamepadconnected', 'gamepaddisconnected'];
  for (const type of events) page.addEventListener(type, refresh);
  doc.addEventListener('visibilitychange', refresh);
  schedule();
  return () => {
    stopped = true;
    refresh();
    doc.removeEventListener('visibilitychange', refresh);
    for (const type of events) page.removeEventListener(type, refresh);
  };
}
