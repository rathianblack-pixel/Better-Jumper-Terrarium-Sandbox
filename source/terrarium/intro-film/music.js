// Procedural intro scores (WebAudio OfflineAudioContext). renderMusic(style) -> [L, R] Float32Arrays
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
function Synth(ctx, revSec) {
  const S = { c: ctx };
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  S.master = ctx.createGain(); S.master.connect(comp); comp.connect(ctx.destination);
  S.dry = ctx.createGain(); S.dry.connect(S.master);
  const conv = ctx.createConvolver(); const len = Math.floor(ctx.sampleRate * revSec), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
  conv.buffer = ir; S.rev = ctx.createGain(); S.rev.connect(conv); const rg = ctx.createGain(); rg.gain.value = 0.55; conv.connect(rg); rg.connect(S.master);
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1; S.noiseBuf = nb;
  S.out = (node, send = 0.35, pan = 0) => { let n = node; if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; n.connect(p); n = p; } n.connect(S.dry); const g = ctx.createGain(); g.gain.value = send; n.connect(g); g.connect(S.rev); };
  S.env = (g, t, att, dur, rel, peak) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + att); g.gain.setValueAtTime(peak, t + Math.max(att, dur)); g.gain.linearRampToValueAtTime(0, t + Math.max(att, dur) + rel); };
  S.noise = (t, dur) => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(t, Math.random()); s.stop(t + dur + 0.05); return s; };
  // sustained pad / strings / brass
  S.pad = (notes, t, dur, o = {}) => {
    const g = ctx.createGain(); S.env(g, t, o.att || 0.6, dur, o.rel || 0.8, o.gain || 0.1);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = o.q || 0.7; f.frequency.setValueAtTime(o.c0 || 800, t); f.frequency.linearRampToValueAtTime(o.c1 || o.c0 || 800, t + (o.cT || dur));
    f.connect(g); S.out(g, o.send == null ? 0.45 : o.send, o.pan || 0);
    let lfo = null; if (o.vib) { lfo = ctx.createOscillator(); lfo.frequency.value = o.vibF || 5; const lg = ctx.createGain(); lg.gain.value = o.vib; lfo.connect(lg); lfo.start(t); lfo.stop(t + dur + (o.rel || 0.8) + 0.1); lfo.lg = lg; }
    let trem = null; if (o.trem) { trem = ctx.createOscillator(); trem.frequency.value = o.trem; const tg = ctx.createGain(); tg.gain.value = 0.5; const bias = ctx.createGain(); bias.gain.value = 0.5; trem.connect(tg); const tgate = ctx.createGain(); tgate.gain.value = 0.5; tg.connect(tgate.gain); f.disconnect(); f.connect(tgate); tgate.connect(g); trem.start(t); trem.stop(t + dur + 2); }
    const nn = notes.length, det = o.det == null ? [-7, 0, 7] : o.det;
    for (const m of notes) for (const d of det) {
      const os = ctx.createOscillator(); os.type = o.type || 'sawtooth'; os.frequency.value = mtof(m); os.detune.value = d + (o.glideFrom ? 0 : 0);
      if (lfo) lfo.lg.connect(os.detune);
      const vg = ctx.createGain(); vg.gain.value = 1 / Math.sqrt(nn * det.length); os.connect(vg); vg.connect(f);
      os.start(t); os.stop(t + dur + (o.rel || 0.8) + 0.1);
    }
  };
  S.pluck = (m, t, o = {}) => {
    const g = ctx.createGain(), dec = o.dec || 1.2, pk = o.gain || 0.1; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + dec);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.bright || 5000, t); f.frequency.exponentialRampToValueAtTime(600, t + dec);
    f.connect(g); S.out(g, o.send == null ? 0.5 : o.send, o.pan || 0);
    for (const [r, a, ty] of [[1, 1, o.type || 'triangle'], [2, 0.3, 'sine'], [3, 0.12, 'sine']]) { const os = ctx.createOscillator(); os.type = ty; os.frequency.value = mtof(m) * r; const vg = ctx.createGain(); vg.gain.value = a; os.connect(vg); vg.connect(f); os.start(t); os.stop(t + dec + 0.05); }
  };
  S.bell = (m, t, o = {}) => {
    const pk = o.gain || 0.1, dec = o.dec || 2.5;
    for (const [r, a, dd] of o.parts || [[1, 1, 1], [2, 0.45, 0.6], [2.76, 0.35, 0.45], [4.07, 0.2, 0.3], [5.4, 0.12, 0.2]]) {
      const os = ctx.createOscillator(); os.type = 'sine'; os.frequency.value = mtof(m) * r; const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk * a, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + dec * dd);
      os.connect(g); S.out(g, o.send == null ? 0.6 : o.send, o.pan || 0); os.start(t); os.stop(t + dec * dd + 0.05);
    }
  };
  S.boom = (t, o = {}) => {
    const os = ctx.createOscillator(); os.type = 'sine'; os.frequency.setValueAtTime(o.f0 || 90, t); os.frequency.exponentialRampToValueAtTime(o.f1 || 40, t + (o.dec || 1) * 0.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(o.gain || 0.4, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t + (o.dec || 1));
    os.connect(g); S.out(g, o.send == null ? 0.25 : o.send); os.start(t); os.stop(t + (o.dec || 1) + 0.05);
    const n = S.noise(t, 0.3), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.nf || 900; const ng = ctx.createGain(); ng.gain.setValueAtTime((o.gain || 0.4) * (o.click == null ? 0.35 : o.click), t); ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.25); n.connect(f); f.connect(ng); S.out(ng, 0.3);
  };
  S.cym = (t, o = {}) => {
    const dur = o.dec || 2.5, n = S.noise(o.swell ? t - o.swell : t, dur + (o.swell || 0)), f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp || 5000;
    const g = ctx.createGain(); if (o.swell) { g.gain.setValueAtTime(0.0005, t - o.swell); g.gain.exponentialRampToValueAtTime(o.gain || 0.1, t); g.gain.linearRampToValueAtTime(0, t + 0.05); } else { g.gain.setValueAtTime(o.gain || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); }
    n.connect(f); f.connect(g); S.out(g, 0.4, o.pan || 0);
  };
  S.hit = (t, o = {}) => { // snare / brush / woodblock-ish noise burst
    const n = S.noise(t, o.dec || 0.2), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.f || 2000; f.Q.value = o.q || 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(o.gain || 0.1, t); g.gain.exponentialRampToValueAtTime(0.0005, t + (o.dec || 0.2)); n.connect(f); f.connect(g); S.out(g, o.send == null ? 0.2 : o.send, o.pan || 0);
    if (o.tone) { const os = ctx.createOscillator(); os.frequency.value = o.tone; const tg = ctx.createGain(); tg.gain.setValueAtTime(o.gain * 1.2, t); tg.gain.exponentialRampToValueAtTime(0.0005, t + 0.08); os.connect(tg); S.out(tg, 0.2, o.pan || 0); os.start(t); os.stop(t + 0.1); }
  };
  S.whoosh = (t, dur, o = {}) => {
    const n = S.noise(t, dur), f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(o.f0 || 300, t); f.frequency.exponentialRampToValueAtTime(o.f1 || 4000, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0005, t); g.gain.exponentialRampToValueAtTime(o.gain || 0.15, t + dur * (o.peak || 0.8)); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    n.connect(f); f.connect(g); S.out(g, 0.5, o.pan || 0);
  };
  S.lead = (m, t, dur, o = {}) => { // brass / flute / whistle style monophonic note
    const os = ctx.createOscillator(); os.type = o.type || 'sawtooth';
    if (o.from != null) { os.frequency.setValueAtTime(mtof(o.from), t); os.frequency.exponentialRampToValueAtTime(mtof(m), t + (o.glide || dur)); } else os.frequency.value = mtof(m);
    const lfo = ctx.createOscillator(); lfo.frequency.value = o.vibF || 5.5; const lg = ctx.createGain(); lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib == null ? 12 : o.vib, t + Math.min(0.3, dur)); lfo.connect(lg); lg.connect(os.detune);
    const f = ctx.createBiquadFilter(); f.type = o.filt || 'lowpass'; f.Q.value = o.q || 1; f.frequency.setValueAtTime(o.c0 || 500, t); f.frequency.linearRampToValueAtTime(o.c1 || 2400, t + Math.min(0.1, dur));
    const g = ctx.createGain(); S.env(g, t, o.att || 0.02, dur, o.rel || 0.08, o.gain || 0.08);
    os.connect(f); f.connect(g); S.out(g, o.send == null ? 0.35 : o.send, o.pan || 0);
    os.start(t); lfo.start(t); os.stop(t + dur + (o.rel || 0.08) + 0.05); lfo.stop(t + dur + 0.3);
    if (o.breath) { const n = S.noise(t, dur), bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = mtof(m) * 2; bf.Q.value = 3; const bg = ctx.createGain(); S.env(bg, t, 0.03, dur, 0.1, o.breath); n.connect(bf); bf.connect(bg); S.out(bg, 0.3, o.pan || 0); }
  };
  S.piano = (m, t, o = {}) => {
    const dec = o.dec || 1.4, pk = o.gain || 0.08;
    for (const [r, a, dd] of [[1, 1, 1], [2, 0.5, 0.7], [3, 0.25, 0.5], [4, 0.12, 0.35]]) { const os = ctx.createOscillator(); os.type = r === 1 ? 'triangle' : 'sine'; os.frequency.value = mtof(m) * r * (1 + (r - 1) * 0.0008); const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk * a, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + dec * dd); os.connect(g); S.out(g, o.send == null ? 0.25 : o.send, o.pan || 0); os.start(t); os.stop(t + dec * dd + 0.05); }
    S.hit(t, { f: 3000, dec: 0.02, gain: pk * 0.25, send: 0.05, pan: o.pan || 0 });
  };
  S.musicbox = (m, t, o = {}) => S.bell(m, t, { gain: o.gain || 0.07, dec: o.dec || 1.8, send: 0.55, pan: o.pan || 0, parts: [[1, 1, 1], [3.0, 0.25, 0.35], [5.97, 0.12, 0.18], [9.2, 0.06, 0.1]] });
  return S;
}
function chordArp(S, notes, t0, step, fn) { notes.forEach((m, i) => fn(m, t0 + i * step, i)); }

// ---------------- HD-2D: cinematic orchestral ambient (D major) ----------------
function scoreHD(S) {
  // 0-2.4 darkness, falling drop
  S.pad([38, 45], 0, 2.3, { gain: 0.12, type: 'sawtooth', c0: 180, c1: 420, att: 1.4, rel: 0.6 });
  S.pad([81, 88], 0.2, 2.1, { gain: 0.02, type: 'sine', att: 1.5, rel: 0.4, send: 0.9 });
  S.bell(93, 0.75, { gain: 0.035, dec: 1.5 });
  S.cym(2.38, { swell: 1.1, gain: 0.07, hp: 4000 });
  S.whoosh(1.2, 1.2, { f0: 2000, f1: 600, gain: 0.05 });
  S.bell(81, 1.9, { gain: 0.2, dec: 3 }); S.bell(88, 1.93, { gain: 0.09, dec: 2.5, pan: 0.3 }); S.boom(1.9, { f0: 140, f1: 60, gain: 0.18, dec: 0.8 });
  // 2.4-5.2 dawn
  S.pad([50, 57, 62, 64, 66], 2.4, 2.75, { gain: 0.15, c0: 500, c1: 2600, att: 0.9, rel: 0.35, vib: 6, vibF: 4.5 });
  S.pad([38], 2.4, 2.8, { gain: 0.12, c0: 250, att: 0.3, rel: 0.3 });
  S.pad([74, 78, 81], 2.5, 2.6, { gain: 0.035, type: 'triangle', att: 1.4, rel: 0.4, send: 0.8, det: [-4, 4] });
  chordArp(S, [62, 66, 69, 73, 74, 78, 81, 85, 86, 90], 2.5, 0.24, (m, t, i) => S.pluck(m, t, { gain: 0.09, dec: 1.8, pan: i % 2 ? 0.35 : -0.35 }));
  S.boom(2.4, { f0: 70, f1: 40, gain: 0.25, dec: 1.6 });
  // 5.2-6.6 eyes: tension
  S.pad([47, 54, 59, 61], 5.2, 1.3, { gain: 0.12, c0: 700, c1: 1400, att: 0.15, rel: 0.2, trem: 9 });
  S.pad([35], 5.2, 1.4, { gain: 0.12, c0: 200, att: 0.1, rel: 0.2 });
  for (const t of [5.25, 5.47, 5.95, 6.17]) S.boom(t, { f0: 75, f1: 38, gain: t % 1 > 0.4 ? 0.32 : 0.22, dec: 0.4, click: 0.1 });
  S.bell(93, 5.6, { gain: 0.06, dec: 1.4 }); S.bell(86, 6.15, { gain: 0.11, dec: 1.4 }); S.bell(98, 6.18, { gain: 0.05, dec: 1.2 });
  S.whoosh(6.05, 0.6, { f0: 400, f1: 5000, gain: 0.12 });
  // 6.6-8.4 leap
  S.pad([43, 55, 59, 62, 66], 6.6, 1.75, { gain: 0.15, c0: 500, c1: 3200, att: 0.25, rel: 0.25, vib: 6 });
  chordArp(S, [67, 71, 74, 76, 79, 83, 86, 88, 91, 95, 98], 6.62, 0.085, (m, t, i) => S.pluck(m, t, { gain: 0.07, dec: 0.9, pan: (i % 3 - 1) * 0.4 }));
  S.whoosh(6.6, 0.75, { f0: 300, f1: 3000, gain: 0.14, pan: -0.4 });
  S.boom(7.9, { f0: 110, f1: 50, gain: 0.25, dec: 0.7 }); S.cym(7.9, { gain: 0.05, dec: 1.2 });
  S.cym(8.4, { swell: 0.5, gain: 0.08 });
  // 8.4-11.2 mantis: epic
  S.boom(8.4, { f0: 95, f1: 42, gain: 0.55, dec: 1.8 }); S.cym(8.4, { gain: 0.12, dec: 2.5, hp: 3500 });
  S.pad([43, 50, 55, 59, 62], 8.4, 1.35, { gain: 0.17, c0: 300, c1: 2400, cT: 0.6, att: 0.08, rel: 0.25, vib: 5 });
  S.pad([67, 71, 74], 8.45, 2.7, { gain: 0.05, type: 'triangle', att: 0.6, rel: 0.4, send: 0.8 });
  S.lead(74, 8.5, 0.6, { gain: 0.05, c0: 600, c1: 2000, att: 0.08 }); S.lead(79, 9.1, 0.65, { gain: 0.05, att: 0.08 });
  S.boom(9.8, { f0: 95, f1: 45, gain: 0.38, dec: 1.2 });
  S.pad([45, 52, 57, 61, 64], 9.8, 1.35, { gain: 0.17, c0: 400, c1: 2800, cT: 0.6, att: 0.08, rel: 0.2, vib: 5 });
  S.lead(81, 9.85, 0.65, { gain: 0.05, att: 0.08 }); S.lead(85, 10.5, 0.6, { gain: 0.05, att: 0.08 });
  for (let i = 0; i < 8; i++) S.boom(10.55 + i * 0.08, { f0: 85, f1: 60, gain: 0.08 + i * 0.03, dec: 0.25, click: 0.4 });
  S.cym(11.2, { swell: 0.8, gain: 0.1 });
  // 11.2-15 reveal
  S.boom(11.2, { f0: 90, f1: 38, gain: 0.6, dec: 2.2 }); S.cym(11.2, { gain: 0.14, dec: 3, hp: 3500 });
  S.pad([38, 50, 57, 62, 66, 69], 11.2, 2.7, { gain: 0.19, c0: 700, c1: 3600, cT: 1.5, att: 0.12, rel: 1.1, vib: 5 });
  S.pad([74, 78, 81, 86], 11.25, 2.8, { gain: 0.05, type: 'triangle', att: 0.8, rel: 1.0, send: 0.9 });
  chordArp(S, [74, 78, 81, 86, 90, 93], 11.3, 0.17, (m, t, i) => S.bell(m, t, { gain: 0.05, dec: 2, pan: i % 2 ? 0.4 : -0.4 }));
  S.whoosh(12.0, 0.7, { f0: 1500, f1: 8000, gain: 0.05 });
  S.bell(86, 12.6, { gain: 0.15, dec: 3 }); S.bell(93, 12.62, { gain: 0.08, dec: 2.6, pan: 0.3 }); S.boom(12.6, { f0: 60, f1: 35, gain: 0.25, dec: 1.4 });
  chordArp(S, [62, 66, 69, 74, 76, 78, 81], 13.0, 0.2, (m, t, i) => S.pluck(m, t, { gain: 0.06, dec: 1.8, pan: i % 2 ? 0.3 : -0.3 }));
}
// ---------------- Cuphead: 1930s ragtime / big band (F major) ----------------
function scoreCup(S) {
  const B = 0.3; // beat
  // 0-2.4 curtain: plinks and slide whistle following the drop
  S.piano(89, 0.25, { gain: 0.05 }); S.piano(86, 0.45, { gain: 0.05 }); S.piano(84, 0.65, { gain: 0.05 });
  S.lead(84, 0.8, 1.05, { type: 'sine', from: 96, glide: 1.05, gain: 0.06, vib: 30, vibF: 6, c0: 4000, c1: 4000, rel: 0.05 });
  S.hit(1.9, { f: 1800, q: 6, dec: 0.12, gain: 0.25, tone: 900 }); S.cym(1.9, { gain: 0.06, dec: 1.2 });
  S.lead(67, 1.92, 0.4, { type: 'sine', from: 79, glide: 0.4, gain: 0.08, vib: 60, vibF: 9, c0: 3000, c1: 3000 });
  S.hit(2.2, { f: 2500, dec: 0.08, gain: 0.08 }); S.hit(2.3, { f: 2500, dec: 0.08, gain: 0.1 });
  // stride piano + bass helper
  const stride = (t0, bars, prog) => { for (let b = 0; b < bars; b++) { const ch = prog[b % prog.length], t = t0 + b * 4 * B; S.piano(ch[0], t, { gain: 0.09, dec: 0.5, pan: -0.2 }); S.piano(ch[1], t + 2 * B, { gain: 0.08, dec: 0.5, pan: -0.2 }); for (const k of [1, 3]) for (const m of ch[2]) S.piano(m, t + k * B, { gain: 0.035, dec: 0.3, pan: 0.15 }); for (let k = 0; k < 4; k++) { S.hit(t + k * B, { f: 7000, dec: 0.05, gain: 0.03, pan: 0.4 }); if (k % 2) S.hit(t + k * B, { f: 1800, dec: 0.15, gain: 0.06, pan: 0.1 }); S.hit(t + k * B + B * 0.66, { f: 7000, dec: 0.04, gain: 0.02, pan: 0.4 }); } } };
  const F = [41, 36, [65, 69, 72]], C7 = [36, 43, [64, 67, 70]], Bb = [46, 41, [65, 70, 74]], D7 = [38, 45, [66, 69, 72]], G7 = [43, 38, [65, 71, 74]];
  // 2.4-5.2 band kicks in
  stride(2.4, 2, [F, C7]); S.piano(41, 4.8, { gain: 0.09, dec: 0.5 });
  const mel = (notes, t0, o = {}) => { let t = t0; for (const [m, d] of notes) { if (m) S.lead(m, t, d * B * 0.85, Object.assign({ type: 'sawtooth', filt: 'bandpass', q: 1.6, c0: 900, c1: 1500, gain: 0.11, vib: 14, pan: 0.15 }, o)); t += d * B; } };
  mel([[72, 0.66], [74, 0.34], [76, 0.66], [77, 0.34], [79, 1], [81, 0.66], [79, 0.34], [77, 1], [76, 0.66], [74, 0.34], [72, 2], [69, 1]], 2.45);
  // 5.2-6.6 stop-time: brass sting + tick-tock
  S.pad([61, 64, 67, 70], 5.2, 0.32, { gain: 0.12, c0: 600, c1: 2600, cT: 0.08, att: 0.02, rel: 0.25, det: [-10, 10] });
  S.boom(5.2, { f0: 70, f1: 50, gain: 0.25, dec: 0.4 });
  [5.5, 5.75, 6.0, 6.25].forEach((t, i) => S.hit(t, { f: i % 2 ? 1200 : 1700, q: 8, dec: 0.08, gain: 0.22, tone: i % 2 ? 700 : 950 }));
  [[45, 5.5], [44, 5.8], [43, 6.1], [42, 6.4]].forEach(([m, t]) => S.lead(m, t, 0.2, { type: 'square', c0: 500, c1: 700, gain: 0.05, vib: 0 }));
  // 6.6-8.4 leap: roll + slide whistle up + crash
  for (let t = 6.6; t < 7.88; t += 0.045) S.hit(t, { f: 2200, dec: 0.06, gain: 0.03 + (t - 6.6) * 0.06 });
  S.lead(88, 6.65, 1.15, { type: 'sine', from: 64, glide: 1.15, gain: 0.07, vib: 25, vibF: 6, c0: 4000, c1: 4000 });
  S.cym(7.9, { gain: 0.14, dec: 1.4, hp: 3000 }); S.boom(7.9, { f0: 90, f1: 50, gain: 0.3, dec: 0.5 });
  chordArp(S, [65, 69, 72, 77, 81, 84], 7.92, 0.04, m => S.piano(m, 7.92 + (m - 65) * 0.004, { gain: 0.05, dec: 0.6 }));
  // 8.4-11.2 fanfare
  S.cym(8.4, { gain: 0.12, dec: 1.5, hp: 3000 }); S.boom(8.4, { f0: 80, f1: 45, gain: 0.35, dec: 0.6 });
  const brass = (ch, t, d) => ch.forEach((m, i) => S.lead(m, t, d, { type: 'sawtooth', c0: 500, c1: 2600, gain: 0.06, vib: 10, pan: (i - 1) * 0.3, att: 0.03 }));
  brass([60, 64, 67], 8.4, 0.25); brass([65, 69, 72], 8.7, 0.25); brass([69, 72, 77], 9.0, 0.25); brass([72, 77, 81], 9.3, 0.45);
  stride(9.0, 2, [Bb, C7]); 
  mel([[79, 0.66], [77, 0.34], [76, 0.66], [74, 0.34], [72, 1], [70, 1], [72, 2]], 9.8, { gain: 0.1 });
  for (let t = 10.6; t < 11.18; t += 0.04) S.hit(t, { f: 2200, dec: 0.06, gain: 0.04 + (t - 10.6) * 0.15 });
  // 11.2-15 tutti, ta-da, shave-and-a-haircut
  S.cym(11.2, { gain: 0.15, dec: 2, hp: 3000 }); S.boom(11.2, { f0: 80, f1: 45, gain: 0.4, dec: 0.6 });
  stride(11.2, 1, [F]);
  mel([[72, 0.66], [74, 0.34], [76, 0.66], [77, 0.34]], 11.2, { gain: 0.12 });
  brass([69, 72, 77], 11.8, 0.6);
  S.pad([65, 69, 72, 74, 77], 12.6, 0.5, { gain: 0.15, c0: 700, c1: 3200, cT: 0.08, att: 0.02, rel: 0.4, det: [-9, 9] });
  S.cym(12.6, { gain: 0.16, dec: 1.6, hp: 2500 }); S.boom(12.6, { f0: 70, f1: 40, gain: 0.4, dec: 0.7 }); S.piano(41, 12.6, { gain: 0.1, dec: 0.8 }); S.piano(29, 12.6, { gain: 0.09, dec: 0.8 });
  // shave and a haircut ... two bits
  [[72, 13.1], [67, 13.4], [67, 13.55], [69, 13.7], [67, 14.0], [71, 14.6], [72, 14.85]].forEach(([m, t], i) => { S.piano(m, t, { gain: 0.09, dec: 0.4 }); S.lead(m, t, 0.12, { type: 'sawtooth', filt: 'bandpass', q: 1.6, c0: 900, c1: 1500, gain: 0.08, vib: 0 }); S.hit(t, { f: 1800, dec: 0.08, gain: 0.05 }); });
  S.piano(48, 14.85, { gain: 0.1, dec: 0.6 }); S.cym(14.85, { gain: 0.06, dec: 0.4 });
}
// ---------------- Storybook: music box waltz + soft strings (C major) ----------------
function scoreStory(S) {
  const B = 0.5;
  // 0-2.4
  S.musicbox(88, 0.2, { gain: 0.05 }); S.musicbox(91, 0.7, { gain: 0.05, pan: 0.3 }); S.musicbox(96, 1.2, { gain: 0.045, pan: -0.3 });
  S.pad([60, 67], 0.1, 2.0, { gain: 0.05, type: 'triangle', att: 1.2, rel: 0.5, send: 0.8, det: [-4, 4] });
  S.musicbox(96, 1.9, { gain: 0.1, dec: 2.4 }); S.bell(84, 1.92, { gain: 0.06, dec: 2.5 });
  chordArp(S, [60, 64, 67, 72, 76, 79, 84, 88], 1.95, 0.065, (m, t, i) => S.pluck(m, t, { gain: 0.05, dec: 1.5, type: 'sine', pan: i % 2 ? 0.3 : -0.3 }));
  // 2.4-5.2 waltz
  S.pad([48, 55, 60, 64], 2.4, 2.75, { gain: 0.1, att: 0.8, rel: 0.35, c0: 600, c1: 1500, vib: 5, vibF: 4.5 });
  const waltz = (t0, bars, chords) => { for (let b = 0; b < bars; b++) { const [bass, ch] = chords[b % chords.length], t = t0 + b * 3 * B; S.pluck(bass, t, { gain: 0.09, dec: 1.2, type: 'triangle', pan: -0.2 }); for (const k of [1, 2]) ch.forEach(m => S.pluck(m, t + k * B, { gain: 0.03, dec: 0.6, type: 'sine', pan: 0.2 })); } };
  waltz(2.4, 2, [[48, [64, 67, 72]], [43, [62, 65, 71]]]);
  [[76, 2.45], [79, 2.95], [84, 3.45], [83, 3.95], [81, 4.2], [79, 4.45], [76, 4.95]].forEach(([m, t], i) => S.musicbox(m, t, { gain: 0.08, pan: (i % 2) * 0.2 - 0.1 }));
  // 5.2-6.6 hush, curious celesta
  S.pad([57, 64, 69], 5.2, 1.3, { gain: 0.07, type: 'triangle', att: 0.3, rel: 0.3, det: [-5, 5] });
  S.pluck(45, 5.2, { gain: 0.08, dec: 1.4, type: 'sine' });
  [[83, 5.35], [81, 5.65], [83, 5.95], [88, 6.2]].forEach(([m, t]) => S.bell(m, t, { gain: 0.06, dec: 1.4 }));
  // 6.6-8.4 harp glissando + flute
  const scale = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88];
  scale.forEach((m, i) => S.pluck(m, 6.6 + i * 0.045, { gain: 0.055, dec: 1.4, type: 'sine', pan: -0.5 + i / scale.length }));
  S.pad([53, 60, 65, 69], 6.6, 1.75, { gain: 0.09, att: 0.4, rel: 0.3, c0: 700, c1: 2000, vib: 5 });
  [[84, 7.0, 0.2], [86, 7.2, 0.2], [88, 7.4, 0.45]].forEach(([m, t, d]) => S.lead(m, t, d, { type: 'sine', gain: 0.05, vib: 10, c0: 3000, c1: 3000, breath: 0.012, att: 0.05 }));
  S.bell(79, 7.9, { gain: 0.07, dec: 2 }); S.bell(84, 7.91, { gain: 0.05, dec: 2 }); S.bell(88, 7.92, { gain: 0.04, dec: 2 });
  // 8.4-11.2 warm horn melody
  S.pad([41, 53, 57, 60, 65], 8.4, 1.35, { gain: 0.11, att: 0.25, rel: 0.25, c0: 600, c1: 1800, vib: 5 });
  S.pad([43, 55, 59, 62, 67], 9.8, 1.35, { gain: 0.11, att: 0.25, rel: 0.3, c0: 600, c1: 2000, vib: 5 });
  S.boom(8.4, { f0: 70, f1: 45, gain: 0.15, dec: 1.2, click: 0.05 }); S.boom(9.8, { f0: 75, f1: 45, gain: 0.12, dec: 1, click: 0.05 });
  waltz(8.4, 2, [[41, [65, 69, 72]], [43, [67, 71, 74]]]);
  [[72, 8.45, 0.45], [74, 8.95, 0.45], [76, 9.45, 0.3], [77, 9.85, 0.45], [79, 10.35, 0.35], [81, 10.7, 0.4]].forEach(([m, t, d]) => S.lead(m, t, d, { type: 'triangle', gain: 0.07, vib: 12, c0: 1200, c1: 2200, att: 0.07, rel: 0.15, breath: 0.01 }));
  // 11.2-15 home
  S.pad([48, 55, 60, 64, 67], 11.2, 2.9, { gain: 0.13, att: 0.4, rel: 1.1, c0: 700, c1: 2400, vib: 5 });
  S.pad([72, 76, 79], 11.3, 2.8, { gain: 0.03, type: 'triangle', att: 0.9, rel: 1.0, send: 0.9, det: [-4, 4] });
  S.boom(11.2, { f0: 65, f1: 40, gain: 0.18, dec: 1.6, click: 0.05 });
  waltz(11.2, 1, [[48, [64, 67, 72]]]);
  [[84, 11.25], [83, 11.5], [84, 11.75], [88, 12.0], [86, 12.3]].forEach(([m, t]) => S.musicbox(m, t, { gain: 0.08 }));
  S.bell(84, 12.6, { gain: 0.1, dec: 3 }); S.bell(91, 12.62, { gain: 0.06, dec: 2.8, pan: 0.3 }); S.bell(96, 12.64, { gain: 0.035, dec: 2.5, pan: -0.3 });
  [[76, 13.1], [79, 13.4], [84, 13.7], [88, 14.0]].forEach(([m, t]) => S.musicbox(m, t, { gain: 0.06 }));
}
window.renderMusic = async function (style) {
  const sr = 48000, dur = 15;
  const ctx = new OfflineAudioContext(2, sr * dur, sr);
  const S = Synth(ctx, style === 'cuphead' ? 1.3 : style === 'storybook' ? 2.2 : 3.2);
  S.master.gain.setValueAtTime(0, 0); S.master.gain.linearRampToValueAtTime(0.9, 0.25);
  S.master.gain.setValueAtTime(0.9, style === 'cuphead' ? 14.9 : 13.6); S.master.gain.linearRampToValueAtTime(0, 15);
  (style === 'cuphead' ? scoreCup : style === 'storybook' ? scoreStory : scoreHD)(S);
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), Rr = buf.getChannelData(1);
  let pk = 0; for (let i = 0; i < L.length; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(Rr[i]));
  const g = 0.89 / (pk || 1);
  const out = new Int16Array(L.length * 2); for (let i = 0; i < L.length; i++) { out[2 * i] = Math.max(-1, Math.min(1, L[i] * g)) * 32767; out[2 * i + 1] = Math.max(-1, Math.min(1, Rr[i] * g)) * 32767; }
  let s = ''; const u8 = new Uint8Array(out.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return { b64: btoa(s), peak: pk };
};
