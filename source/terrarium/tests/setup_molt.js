(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs);
  try { JT.UI.closeModal(); } catch (e) {}
  const g = JT.app.game, h = g.hab; const sp = h.spiders[0]; sp.species = window._sp || 'chinese'; sp.stage = 3; sp.sat = 0.9; sp.meals = 99; JT.SpiderAI.setState(sp, 'idle');
  const want = window._until || 'premolt'; for (let i = 0; i < 60 * 120 && sp.state !== want; i++) g.tick(1 / 60);
  if (window._extra) for (let i = 0; i < 60 * window._extra; i++) g.tick(1 / 60);
  window._probe = () => { const R = JT.app.R, s = JT.app.game.hab.spiders[0]; const p = R.V.P(s.pos); const cv = R.cv || document.querySelector('canvas'); const r = cv.getBoundingClientRect(); const k = r.width / cv.width;
    const x = r.left + p[0] * k, y = r.top + p[1] * k; return { clip: { x: Math.max(0, Math.min(1100 - 560, x - 280)), y: Math.max(0, Math.min(720 - 560, y - 200)), width: 560, height: 560 }, data: { st: s.state, stage: s.stage, sup: s.sup && s.sup.k, hang: +(s._mHangK || 0).toFixed(2), slide: +(s._mSlide || 0).toFixed(2), thought: s.thought } }; };
  JT.UI.toggleObserve(true, sp.id);
  return { st: sp.state, shots: [3000, 4000] };
})()
