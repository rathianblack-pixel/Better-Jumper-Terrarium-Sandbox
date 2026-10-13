(() => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs);
  try { JT.UI.closeModal(); } catch (e) {}
  const g = JT.app.game, h = g.hab, B = JT.Biome, bid = window._bid || 'orchidgarden';
  const theme = B.layout(h, bid, 777); g.save();
  try { JT.app.refreshHeader && JT.app.refreshHeader(); } catch (e) {}
  const S = id => JT.DECOR_BY_ID[id] ? B.suit(JT.DECOR_BY_ID[id], bid) : 'missing';
  const bm = JT.BIOMES[bid];
  return { bid, theme, name: bm.name, icon: bm.icon, prey: bm.prey, events: bm.events, sub: h.data.sub || h.data.substrate, decor: h.data.decor.map(d => d.type),
    suit: { meshlid: S('meshlid'), crossperch: S('crossperch'), flowerspike: S('flowerspike'), orchidspray: S('orchidspray'), deadleafbranch: S('deadleafbranch'), twigtangle: S('twigtangle'), tallTwig: S('tallTwig') },
    natives: B.natives(bid), rank: { orchid: B.rank('orchid').slice(0, 2), ghost: B.rank('ghost').slice(0, 2) }, label: B.label(h, h.spiders[0] && h.spiders[0].species), order: JT.BIOME_ORDER, shots: [2500] };
})()
