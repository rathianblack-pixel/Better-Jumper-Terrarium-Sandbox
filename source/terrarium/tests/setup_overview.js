(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs);
  try { JT.UI.closeModal(); } catch (e) {}
  const g = JT.app.game, h = g.hab; const lid = h.data.decor.find(d => d.type === 'meshlid'); const gl = lid && h.geoms[lid.id];
  return { lid: !!lid, paths: gl ? gl.paths.length : 0, navNodes: h.nav.nodes.length, lidNodes: h.nav.nodes.filter(n => n.decor === (lid && lid.id)).length, dims: h.dims, shots: [1500] };
})()
