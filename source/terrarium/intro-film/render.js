// usage: node render.js <style> <orient> <clip:intro|loop> <out> [stills: comma frames]
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
(async () => {
  const [style, orient, clip, out, stills] = process.argv.slice(2);
  const W = orient === 'portrait' ? 1080 : 1920, H = orient === 'portrait' ? 1920 : 1080;
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  p.on('console', m => console.log('page:', m.text())); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + require('path').join(__dirname, 'index.html'));
  await p.evaluate(([W, H, s, o]) => setupIntro(W, H, s, o), [W, H, style, orient]);
  const fn = clip === 'loop' ? 'renderLoopFrame' : 'renderIntroFrame';
  const total = clip === 'loop' ? 300 : 450;
  const grab = async (f) => { const d = await p.evaluate(([fn, f]) => { window[fn](f); return document.getElementById('out').toDataURL('image/jpeg', 0.95); }, [fn, f]); return Buffer.from(d.split(',')[1], 'base64'); };
  if (stills) {
    for (const f of stills.split(',').map(Number)) fs.writeFileSync(`${out}_${String(f).padStart(3, '0')}.jpg`, await grab(f));
  } else {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]);
    ff.stderr.on('data', d => process.stderr.write(d));
    const t0 = Date.now();
    for (let f = 0; f < total; f++) { const buf = await grab(f); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); if (f % 50 === 0) console.log(`frame ${f}/${total} ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
  }
  await b.close(); console.log('done');
})();
