(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs);
  try { JT.UI.closeModal(); } catch (e) {}
  const g = JT.app.game, h = g.hab; const sp = h.spiders[0];
  window._probe = () => { const R = JT.app.R, s = JT.app.game.hab.spiders[0]; const p = R.V.P(s.pos); const cv = R.cv || document.querySelector('canvas'); const r = cv.getBoundingClientRect(); const k = r.width / cv.width;
    const x = r.left + p[0] * k, y = r.top + p[1] * k; return { clip: { x: Math.max(0, Math.min(1100 - 420, x - 210)), y: Math.max(0, Math.min(720 - 420, y - 210)), width: 420, height: 420 }, data: { st: s.state, stage: s.stage, sp: s.species, sup: s.sup && s.sup.k, thought: s.thought } }; };
  if (window._mode !== 'overview') JT.UI.toggleObserve(true, sp.id);
  return { species: sp.species, stage: sp.stage, n: h.spiders.length, shots: [4000, 5000, 5000, 5000] };
})()
