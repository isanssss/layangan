// Boot and the one loop. The UI owns the screens and steps the duel in fixed 1/60 s
// steps; this file only wires the page together — canvas, input, audio, the status line —
// and runs the frame clock.
//
// ?seed=N fixes the weather and rivals. ?shot=title|duel|cut|victory (with &seed=N)
// stages that screenshot scene instead of running the loop, paints it twice and sets
// window.__shotReady (and window.__shotInfo) for the screenshotter.
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createUI } from './ui.js';
import { createShotScene } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

if (shot) {
  const scene = createShotScene(shot, seed);
  window.__shotInfo = scene.info;
  let painted = 0;
  const paint = () => {
    renderer.begin();
    scene.draw(renderer.ctx);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  const audio = createAudio();
  const input = createInput(canvas, (x, y) => renderer.toVirtual(x, y));
  const ui = createUI({
    renderer,
    input,
    audio,
    seed,
    announce(screen) {
      status.textContent = `LAYANGAN — layar ${screen}`;
    },
  });
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    ui.frame(dt, input.takeActions());
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ui.autoPause();
  });
  status.textContent = 'LAYANGAN — War of Strings. Klik atau tekan Enter untuk mulai.';
  requestAnimationFrame(frame);
}
