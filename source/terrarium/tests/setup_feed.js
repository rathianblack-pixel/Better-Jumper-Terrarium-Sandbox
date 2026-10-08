(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs);
  try { JT.UI.closeModal(); } catch (e) {}
  const g = JT.app.game, h = g.hab; const sp = h.spiders[0]; sp.species = window._sp || 'chinese'; sp.stage = 5; sp.sat = 0.1; h.daylight = () => 1;
  h.data.prey.length = 0; h.addPrey(window._prey || 'cricket', 2);
  let k = 0; for (; k < 60 * 240 && !(sp.state === 'feed' && sp.hold && (h.preyById(sp.hold) || {})._mEat > (window._eat || 0.3)); k++) g.tick(1 / 60);
  window._probe = () => { const R = JT.app.R, s = JT.app.game.hab.spiders[0]; const p = R.V.P(s.pos); const cv = R.cv || document.querySelector('canvas'); const r = cv.getBoundingClientRect(); const kk = r.width / cv.width;
    const x = r.left + p[0] * kk, y = r.top + p[1] * kk; const hp = s.hold && JT.app.game.hab.preyById(s.hold); return { clip: { x: Math.max(0, Math.min(1100 - 560, x - 280)), y: Math.max(0, Math.min(720 - 560, y - 300)), width: 560, height: 560 }, data: { st: s.state, eat: hp ? +(hp._mEat || 0).toFixed(2) : null, gone: hp ? Object.keys(hp._mGone || {}) : null, parts: JT.app.game.hab.data.remains.filter(r => r.cat === 'mpart').length, thought: s.thought } }; };
  JT.UI.toggleObserve(true, sp.id);
  return { simSec: +(k / 60).toFixed(1), st: sp.state, shots: [2500, 2500] };
})()
