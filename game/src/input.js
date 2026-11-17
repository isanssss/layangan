// Pointer and keyboard input. The kite seeks the pointer, so the pointer's position in
// virtual field coordinates is the heart of it; holding the pointer (or Space) is "tarik",
// the pull. One-shot presses (confirm, pause, mute) queue as bit flags and are taken once by
// the loop, so a press between frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const STEER = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS']);

/**
 * Create the input reader. `toVirtual(clientX, clientY)` maps a pointer event's client
 * coordinates into the 1280x720 field (the renderer owns that mapping).
 */
export function createInput(target, toVirtual) {
  const pointer = { x: 640, y: 300, down: false, seen: false };
  const keys = new Set();
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (STEER.has(event.code) || event.code === 'Space') {
      keys.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    pointer.down = false;
  });

  function trackPointer(event) {
    const p = toVirtual(event.clientX, event.clientY);
    pointer.x = p.x;
    pointer.y = p.y;
    pointer.seen = true;
  }
  target.addEventListener('pointermove', trackPointer);
  target.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    pointer.down = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    pointer.down = false;
  });
  target.addEventListener('pointerleave', () => {
    pointer.down = false;
  });

  return {
    pointer,
    /** True while tarik is held: pointer down or Space down. */
    pulling() {
      return pointer.down || keys.has('Space');
    },
    /** Steering direction from the keys: {x, y} each in -1..1 (y down-positive). */
    steer() {
      const x = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const y = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      return { x, y };
    },
    /** True while any steering key is held. */
    steering() {
      for (const code of keys) if (STEER.has(code)) return true;
      return false;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
