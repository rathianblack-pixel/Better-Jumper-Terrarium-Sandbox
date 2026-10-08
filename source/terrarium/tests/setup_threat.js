(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs);
  try { JT.UI.closeModal(); } catch (e) {}
  const g = JT.app.game, h = g.hab, M = JT.M; const sp = h.spiders[0]; sp.species = window._sp || 'chinese'; sp.stage = 5; sp.sat = 1; h.data.prey.length = 0; h.daylight = () => 1;
  JT.SpiderAI.dropTarget(h, sp); JT.SpiderAI.setState(sp, 'idle'); sp._mDispCD = 0; sp._fingerCD = 0; sp.tame = 0;
  for (let k = 0; k < 6 && sp.state !== 'display'; k++) { sp._mDispCD = 0; sp._fingerCD = 0; sp._fingerSeen = null; JT.SpiderAI.setState(sp, 'idle'); h.finger = { id: 'f' + k, pos: M.add(sp.pos, [3, 3, 3]), t: h.time, fast: true }; for (let i = 0; i < 6; i++) g.tick(1 / 60); }
  h.finger = null;
  window._probe = () => { const R = JT.app.R, s = JT.app.game.hab.spiders[0]; const p = R.V.P(s.pos); const cv = R.cv || document.querySelector('canvas'); const r = cv.getBoundingClientRect(); const k = r.width / cv.width;
    const x = r.left + p[0] * k, y = r.top + p[1] * k; return { clip: { x: Math.max(0, Math.min(1100 - 560, x - 280)), y: Math.max(0, Math.min(720 - 560, y - 300)), width: 560, height: 560 }, data: { st: s.state, thought: s.thought } }; };
  JT.UI.toggleObserve(true, sp.id);
  return { st: sp.state, shots: [1200] };
})()
