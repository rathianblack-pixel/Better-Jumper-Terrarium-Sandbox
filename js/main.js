/* Jumper Terrarium — boot + main loop (fixed-step simulation, variable-rate rendering). */
(function (root) {
  'use strict';
  const JT = root.JT;
  function boot() {
    const settings = JT.Settings.load();
    const game = new JT.Game();
    let restored = false; try { restored = game.load(); } catch (e) { console.error(e); }
    if (!restored) game.newGame();
    if (!game.hab.spider(game.selectedId)) game.selectedId = game.hab.spiders[0] ? game.hab.spiders[0].id : null;
    const R = new JT.Renderer(document.getElementById('view'), game, settings);
    JT.Audio.init(settings);
    JT.UI.init(game, R, settings);
    JT.app = { game, R, settings, UI: JT.UI };
    if (restored && game._gifted) setTimeout(() => JT.UI.toast('🌿 A <b>Moss Tower</b> made for portrait screens was added to your shelf — meet <b>Moss</b>, a young Regal Jumper.', '', 6500), 600);
    if (!restored) setTimeout(() => JT.UI.toast('Welcome! Meet <b>Bolt</b>, your Bold Jumper. Click a jumper to see what it is thinking.', '', 6000), 600);
    document.addEventListener('visibilitychange', () => { game.viewing = !document.hidden; if (document.hidden) game.save(); });
    root.addEventListener('pagehide', () => game.save());
    root.addEventListener('beforeunload', () => game.save());
    const STEP = 1 / 30; let acc = 0, last = performance.now(), skip = false, half = false, cost = 8, lastDt = 0;
    function frame(now) {
      let dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
      acc += dt; let n = 0;
      try { while (acc >= STEP && n < 4) { game.tick(STEP); acc -= STEP; n++; } if (n >= 4) acc = 0; } catch (e) { console.error('sim', e); acc = 0; }
      try { JT.UI.update(dt); JT.Audio.update(dt, game); } catch (e) { console.error('ui', e); }
      // adaptive pacing: if a frame costs too much, render at half rate (simulation keeps full rate)
      skip = !skip;
      if (!(half && skip)) { const t0 = performance.now(); try { R.render(half ? dt + lastDt : dt); } catch (e) { console.error('render', e); } const ms = performance.now() - t0; cost = cost * 0.9 + ms * 0.1; R.frameMs = cost; if (settings.quality === 'auto') { if (!half && cost > 13) half = true; else if (half && cost < 6) half = false; } }
      lastDt = dt;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
