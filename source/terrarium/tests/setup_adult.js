(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs);
  try { JT.UI.closeModal(); } catch (e) {}
  const g = JT.app.game, h = g.hab; const sp = h.spiders[0]; sp.species = window._sp || 'chinese'; sp.stage = 5; sp.sat = 0.2;
  window._probe = () => { const R = JT.app.R, s = JT.app.game.hab.spiders[0]; const p = R.V.P(s.pos); const cv = R.cv || document.querySelector('canvas'); const r = cv.getBoundingClientRect(); const k = r.width / cv.width;
    const x = r.left + p[0] * k, y = r.top + p[1] * k; return { clip: { x: Math.max(0, Math.min(1100 - 560, x - 280)), y: Math.max(0, Math.min(720 - 560, y - 280)), width: 560, height: 560 }, data: { st: s.state, stage: s.stage, sp: s.species, sup: s.sup && s.sup.k, thought: s.thought } }; };
  if (window._mode !== 'overview') JT.UI.toggleObserve(true, sp.id);
  return { species: sp.species, stage: sp.stage, n: h.spiders.length, shots: [4000, 5000, 5000, 5000] };
})()
