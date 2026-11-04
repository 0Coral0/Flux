(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root?.document) root.fluxParticles = api.create(root);
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  function create(win) {
    const doc = win.document, canvas = doc.getElementById('particle-canvas'), ctx = canvas?.getContext('2d');
    const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    const coarse = win.matchMedia?.('(pointer: coarse)');
    let started = false, enabled = true, paused = false, liteMode = win.fluxPerformance?.isEnabled() === true, frame = null, lastPaint = 0;
    let points = [], pointer = null, resized = true, retarget = true;
    const canDraw = () => ctx && enabled && !paused && !liteMode && !doc.hidden;
    function cancel() {
      if (frame !== null) win.cancelAnimationFrame(frame);
      frame = null;
    }
    function wake() {
      if (started && canDraw() && frame === null) frame = win.requestAnimationFrame(draw);
    }
    function sync() {
      if (canDraw()) { lastPaint = 0; wake(); }
      else { cancel(); ctx?.clearRect(0, 0, canvas.width, canvas.height); }
    }
    function resize() {
      canvas.width = win.innerWidth; canvas.height = win.innerHeight;
      const spacing = Math.max(50, Math.sqrt(canvas.width * canvas.height / 450));
      points = [];
      for (let x = spacing / 2; x < canvas.width; x += spacing) {
        for (let y = spacing / 2; y < canvas.height && points.length < 500; y += spacing) {
          points.push({ x, y, baseX: x, baseY: y, targetX: x, targetY: y });
        }
      }
      resized = false; retarget = true;
    }
    function draw(now) {
      frame = null;
      if (!canDraw()) return;
      if (lastPaint && now - lastPaint < 1000 / 30) { wake(); return; }
      const blend = Math.min(1, 1 - Math.pow(.8, Math.min(80, now - lastPaint || 33) / 16.67));
      lastPaint = now;
      if (resized) resize();
      if (retarget) {
        for (const point of points) {
          point.targetX = point.baseX; point.targetY = point.baseY;
          if (!pointer || reduced?.matches || coarse?.matches) continue;
          const dx = point.baseX - pointer.x, dy = point.baseY - pointer.y, distance = Math.hypot(dx, dy);
          if (distance > 0 && distance < 110) {
            const offset = (1 - distance / 110) * 24;
            point.targetX += dx / distance * offset; point.targetY += dy / distance * offset;
          }
        }
        retarget = false;
      }
      let moving = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#888888'; ctx.globalAlpha = .4; ctx.beginPath();
      for (const point of points) {
        const dx = point.targetX - point.x, dy = point.targetY - point.y;
        if (!reduced?.matches && (Math.abs(dx) > .05 || Math.abs(dy) > .05)) {
          point.x += dx * blend; point.y += dy * blend; moving = true;
        } else { point.x = point.targetX; point.y = point.targetY; }
        ctx.moveTo(point.x + 1.5, point.y); ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2);
      }
      ctx.fill();
      // A settled background needs no more animation frames until input changes.
      if (moving) wake();
    }
    function move(event) {
      if (!canDraw() || reduced?.matches || coarse?.matches || event.pointerType === 'touch') return;
      pointer = { x: event.clientX, y: event.clientY }; retarget = true; wake();
    }
    function leave(event) {
      if (event?.relatedTarget) return;
      pointer = null; retarget = true; wake();
    }
    function onResize() { resized = true; wake(); }
    function onMotion() { pointer = null; retarget = true; wake(); }
    return {
      start(options = {}) {
        enabled = options.enabled !== false;
        if (!ctx) return;
        if (!started) {
          started = true;
          win.addEventListener('pointermove', move, { passive: true });
          win.addEventListener('pointerout', leave, { passive: true });
          win.addEventListener('blur', leave);
          win.addEventListener('resize', onResize, { passive: true });
          doc.addEventListener('visibilitychange', sync);
          reduced?.addEventListener?.('change', onMotion);
          coarse?.addEventListener?.('change', onMotion);
        }
        sync();
      },
      setEnabled(value) { enabled = !!value; sync(); },
      setLiteMode(value) { liteMode = !!value; pointer = null; retarget = true; sync(); },
      setPaused(value) { paused = !!value; pointer = null; retarget = true; sync(); },
      destroy() {
        cancel(); started = false;
        win.removeEventListener('pointermove', move); win.removeEventListener('pointerout', leave);
        win.removeEventListener('blur', leave); win.removeEventListener('resize', onResize);
        doc.removeEventListener('visibilitychange', sync);
        reduced?.removeEventListener?.('change', onMotion); coarse?.removeEventListener?.('change', onMotion);
      }
    };
  }
  return { create };
});
