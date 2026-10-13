(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs);
  try { JT.UI.closeModal(); } catch (e) {}
  const g = JT.app.game, h = g.hab; const sp = h.spiders[0]; sp.stage = window._stage || 3; h.mist(); h.mist();
  // put a drop + beads right next to the critter's support so the close-up shows them
  const n = h.nav.nodes.filter(n => n.sup && n.sup.k === 'path').sort((a, b) => JT.M.dist(a.pos, sp.pos) - JT.M.dist(b.pos, sp.pos))[0];
  JT.UI.toggleObserve(true, sp.id);
  return { shots: [5000] };
})()
