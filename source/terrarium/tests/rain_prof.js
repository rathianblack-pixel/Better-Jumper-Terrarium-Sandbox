// node tests/rain_prof.js <dist-dir> [rain|dry] : CPU profile (top self time) of the running game
const { chromium } = require('playwright'); const path = require('path'); const [dir, mode] = process.argv.slice(2);
(async () => { const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  await p.goto('file://' + path.resolve(dir) + '/index.html'); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(3500);
  await p.evaluate((mode) => { const cs = document.createElement('style'); cs.textContent = '#modalWrap{display:none!important}'; document.head.appendChild(cs); try { JT.UI.closeModal(); } catch (e) {}
    const h = JT.app.game.hab; h.data.biome = 'rainforest'; if (mode === 'rain') JT.Biome.start(h, 'rain'); }, mode || 'rain');
  await p.waitForTimeout(9000);
  const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
  await p.waitForTimeout(6000); const { profile } = await cdp.send('Profiler.stop');
  const self = new Map(); const byId = new Map(profile.nodes.map(n => [n.id, n])); const dtS = profile.timeDeltas; const cnt = new Map();
  profile.samples.forEach((id, i) => cnt.set(id, (cnt.get(id) || 0) + (dtS[i] || 0)));
  let total = 0; for (const [id, t] of cnt) { const n = byId.get(id); const cf = n.callFrame; const k = (cf.functionName || '(anon)') + ':' + cf.lineNumber; self.set(k, (self.get(k) || 0) + t); total += t; }
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, t]) => (t / 1000).toFixed(0).padStart(6) + 'ms ' + (100 * t / total).toFixed(1).padStart(5) + '% ' + k);
  console.log('total', (total / 1000).toFixed(0), 'ms\n' + top.join('\n')); await b.close(); })();
