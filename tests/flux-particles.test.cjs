const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../js/flux-particles.js');

function fixture({ reduced = false, coarse = false, lite = false, width = 1280, height = 720 } = {}) {
  const events = {}, media = {}, frames = new Map();
  let next = 0, time = 100, draws = 0, dots = 0, currentDots = 0;
  const ctx = { clearRect() {}, beginPath() { currentDots = 0; }, moveTo() {}, arc() { currentDots++; }, fill() { draws++; dots = currentDots; } };
  const canvas = { width: 0, height: 0, getContext: () => ctx };
  const doc = { hidden: false, getElementById: () => canvas,
    addEventListener: (name, fn) => { events[name] = fn; }, removeEventListener: name => { delete events[name]; } };
  const win = { document: doc, innerWidth: width, innerHeight: height, fluxPerformance: { isEnabled: () => lite },
    matchMedia(query) { return media[query] ||= { matches: query.includes('reduced') ? reduced : coarse,
      addEventListener(name, fn) { this.change = fn; }, removeEventListener() {} }; },
    requestAnimationFrame: fn => { const id = ++next; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => { frames.delete(id); },
    addEventListener: (name, fn) => { events[name] = fn; }, removeEventListener: name => { delete events[name]; }
  };
  const controller = create(win);
  const tick = (ms = 40) => { time += ms; const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn(time)); };
  const settle = () => { for (let step = 0; frames.size && step < 200; step++) tick(); assert.equal(frames.size, 0, 'animation must settle'); };
  return { controller, win, doc, events, media, frames, tick, settle, draws: () => draws, dots: () => dots };
}

test('an idle grid paints once and does not keep requesting animation frames', () => {
  const ui = fixture(); ui.controller.start(); ui.tick();
  assert.equal(ui.draws(), 1); assert.equal(ui.frames.size, 0);
  ui.events.pointermove({ clientX: 30, clientY: 30 });
  assert.equal(ui.frames.size, 1); ui.settle();
  const completed = ui.draws(); ui.tick(); assert.equal(ui.draws(), completed);
  ui.events.pointerout({ relatedTarget: null }); ui.settle();
});

test('rapid input and preference toggles cannot create duplicate animation loops', () => {
  const ui = fixture(); ui.controller.start(); ui.controller.start();
  for (let index = 0; index < 20; index++) {
    ui.controller.setEnabled(false); ui.controller.setEnabled(true);
    ui.events.pointermove({ clientX: index, clientY: 30 });
    assert.equal(ui.frames.size, 1);
  }
  ui.tick(); const painted = ui.draws();
  ui.tick(5); assert.equal(ui.draws(), painted, 'painting is capped below the display refresh rate');
  ui.settle();
});

test('games, hidden tabs, and disabled effects cancel pending work and resume safely', () => {
  const ui = fixture(); ui.controller.start(); ui.tick();
  ui.events.pointermove({ clientX: 30, clientY: 30 });
  ui.controller.setPaused(true); assert.equal(ui.frames.size, 0);
  ui.events.pointermove({ clientX: 40, clientY: 40 }); assert.equal(ui.frames.size, 0);
  ui.controller.setPaused(false); ui.settle();
  ui.doc.hidden = true; ui.events.visibilitychange(); assert.equal(ui.frames.size, 0);
  ui.events.pointermove({ clientX: 30, clientY: 30 }); assert.equal(ui.frames.size, 0);
  ui.doc.hidden = false; ui.events.visibilitychange(); ui.settle();
  ui.controller.setEnabled(false); ui.events.resize(); assert.equal(ui.frames.size, 0);
  ui.controller.setEnabled(true); ui.settle();
  ui.controller.destroy(); assert.equal(ui.frames.size, 0); assert.equal(ui.events.pointermove, undefined);
});

test('reduced motion and touch devices keep a static grid, with bounded work on large screens', () => {
  for (const options of [{ reduced: true }, { coarse: true }, { width: 7680, height: 4320 }]) {
    const ui = fixture(options); ui.controller.start(); ui.tick();
    assert.ok(ui.dots() <= 500);
    if (options.reduced || options.coarse) {
      ui.events.pointermove({ clientX: 30, clientY: 30 }); assert.equal(ui.frames.size, 0);
    }
  }
});

test('Lite Mode blocks particle work from startup and respects the game pause and normal preference when disabled', () => {
  const ui = fixture({ lite: true }); ui.controller.start();
  assert.equal(ui.frames.size, 0); assert.equal(ui.draws(), 0);
  ui.events.pointermove({ clientX: 30, clientY: 30 }); assert.equal(ui.frames.size, 0);
  ui.controller.setPaused(true); ui.controller.setLiteMode(false); assert.equal(ui.frames.size, 0);
  ui.controller.setPaused(false); ui.settle(); assert.equal(ui.draws(), 1);
  ui.events.pointermove({ clientX: 30, clientY: 30 });
  ui.controller.setLiteMode(true); assert.equal(ui.frames.size, 0);
  ui.controller.setEnabled(false); ui.controller.setLiteMode(false); assert.equal(ui.frames.size, 0);
});
