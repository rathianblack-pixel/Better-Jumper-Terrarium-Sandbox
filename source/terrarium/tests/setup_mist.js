(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs);
  try { JT.UI.closeModal(); } catch (e) {}
  const g = JT.app.game, h = g.hab; const sp = h.spiders[0]; if (window._stage) sp.stage = window._stage;
  h.mist(); h.mist();
  const ds = h.data.drops.filter(d => !d.pool); const rs = ds.map(d => d.r);
  // clip around the drop nearest the middle of the screen
  window._probe = () => { const R = JT.app.R, hh = JT.app.game.hab; const cv = R.cv || document.querySelector('canvas'); const rc = cv.getBoundingClientRect(); const k = rc.width / cv.width;
    let best = null, bd = 1e9; for (const d of hh.data.drops) { if (d.pool || !d.tiny) continue; const p = R.V.P(d.pos); const x = rc.left + p[0] * k, y = rc.top + p[1] * k; const dd = Math.hypot(x - 550, y - 360); if (dd < bd) { bd = dd; best = [x, y]; } }
    if (!best) return { data: 'none' }; return { clip: { x: Math.max(0, Math.min(1100 - 300, best[0] - 150)), y: Math.max(0, Math.min(720 - 300, best[1] - 150)), width: 300, height: 300 }, data: { n: hh.data.drops.length } }; };
  return { n: ds.length, tiny: ds.filter(d => d.tiny).length, base: JT.dropSize(h), rmin: Math.min(...rs).toFixed(2), rmax: Math.max(...rs).toFixed(2), shots: [1500] };
})()
