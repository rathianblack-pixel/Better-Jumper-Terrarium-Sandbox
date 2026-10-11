const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage(); p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => console.log('page:', m.text()));
  await p.setContent('<html><body></body></html>'); await p.addScriptTag({ path: require('path').join(__dirname, 'music.js') });
  for (const st of ['hd2d', 'cuphead', 'storybook']) {
    const r = await p.evaluate(s => renderMusic(s), st);
    const pcm = Buffer.from(r.b64, 'base64'), h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(48000, 24); h.writeUInt32LE(192000, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(require('path').join(__dirname, 'out', `music-${st}.wav`), Buffer.concat([h, pcm])); console.log(st, 'peak', r.peak.toFixed(3));
  }
  await b.close();
})();
