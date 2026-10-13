/* Jumper Terrarium — procedural WebAudio: calm generative music, sparse creature ambience, effects.
   No samples, no rain. Three independent buses (Music / Ambience / Effects). */
(function (root) {
  'use strict';
  const JT = root.JT;
  const Audio = JT.Audio = {
    ctx: null, buses: {}, started: false, set: null, _musT: 0, _ambT: 0, _chord: 0,
    init(settings) { this.set = settings; },
    /** iOS: Web Audio only unlocks inside a touchend/click handler, is silenced by the ring/silent switch unless the
        audio session is 'playback', and comes back 'interrupted' after the app was in the background. */
    unlockIOS() {
      try { if (root.navigator && navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* older iOS */ }
      if (!this._silent && root.document) { // a looping silent <audio> moves older iOS into the playback category (ignores the silent switch)
        try { const n = 4410, b = new Uint8Array(44 + n * 2), v = new DataView(b.buffer); const w = (o, t) => { for (let i = 0; i < t.length; i++) b[o + i] = t.charCodeAt(i); };
          w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 44100, true); v.setUint32(28, 88200, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
          const el = document.createElement('audio'); el.src = URL.createObjectURL(new Blob([b], { type: 'audio/wav' })); el.loop = true; el.setAttribute('playsinline', ''); el.setAttribute('x-webkit-airplay', 'deny'); el.preload = 'auto'; el.volume = 0.01; this._silent = el;
        } catch (e) { this._silent = false; }
      }
      if (this._silent && this._silent.paused && !(this.set && this.set.muted)) { const pr = this._silent.play(); if (pr && pr.catch) pr.catch(() => {}); }
    },
    start() {
      const ios = root.navigator && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
      if (ios) this.unlockIOS();
      if (this.started) {
        const c = this.ctx; if (c && c.state !== 'running') { const pr = c.resume(); if (pr && pr.catch) pr.catch(() => {}); this._kick(); }
        return;
      }
      const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      this._kick();
      const c = this.ctx; this.master = c.createGain(); this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.connect(this.master);
      // gentle feedback-delay "room" for music
      this.delay = c.createDelay(1.5); this.delay.delayTime.value = 0.42; const fb = c.createGain(); fb.gain.value = 0.32; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      this.delay.connect(lp); lp.connect(fb); fb.connect(this.delay); lp.connect(comp);
      for (const k of ['music', 'ambience', 'effects']) { const g = c.createGain(); g.connect(comp); this.buses[k] = g; }
      this.buses.music.connect(this.delay);
      this._lofiChain(c);
      this._beds(c);
      this.started = true; this.apply();
    },
    /** play one silent sample inside the gesture: required by iOS Safari to really start the context */
    _kick() { try { const c = this.ctx; const b = c.createBuffer(1, 1, 22050); const src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0); if (c.state !== 'running') { const pr = c.resume(); if (pr && pr.catch) pr.catch(() => {}); } } catch (e) { /* ignore */ } },
    apply() { if (this._silent) { if (this.set.muted) this._silent.pause(); else if (this._silent.paused && this.started) { const pr = this._silent.play(); if (pr && pr.catch) pr.catch(() => {}); } }
      if (!this.started) return; const s = this.set; const t = this.ctx.currentTime; this.master.gain.setTargetAtTime(s.muted ? 0 : 0.9, t, 0.05); this.buses.music.gain.setTargetAtTime(s.music * 0.5, t, 0.1); this.buses.ambience.gain.setTargetAtTime(s.ambience * 0.6, t, 0.1); this.buses.effects.gain.setTargetAtTime(s.effects * 0.8, t, 0.05); },
    tone(bus, freq, dur, o) {
      if (!this.started) return; o = o || {}; const c = this.ctx; const t = c.currentTime + (o.delay || 0);
      const osc = c.createOscillator(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
      const g = c.createGain(); const a = o.vol || 0.2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(a, t + (o.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      let node = osc; if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
      node.connect(g); g.connect(this.buses[bus]); osc.start(t); osc.stop(t + dur + 0.05);
      if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibAmt || 6; l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur); }
    },
    noise(bus, dur, o) {
      if (!this.started) return; o = o || {}; const c = this.ctx; const t = c.currentTime + (o.delay || 0);
      const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = o.ft || 'bandpass'; f.frequency.value = o.f || 2000; f.Q.value = o.q || 1;
      if (o.fTo) f.frequency.exponentialRampToValueAtTime(o.fTo, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t + (o.att || 0.01)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.buses[bus]); src.start(t); src.stop(t + dur + 0.02);
    },
    // ---- effects ----
    sfx(name) {
      if (!this.started) return;
      if (name === 'strike' || name === 'strikeFly') this.swell(0.25); else if (name === 'molt') this.swell(0.6); else if (name === 'journal') this.swell(0.35);
      switch (name) {
        case 'click': this.tone('effects', 880, 0.08, { type: 'triangle', vol: 0.08 }); break;
        case 'shutter': this.noise('effects', 0.05, { f: 3200, q: 1.4, vol: 0.16, att: 0.002 }); this.noise('effects', 0.07, { f: 1800, q: 1.2, vol: 0.12, att: 0.002, delay: 0.09 }); break;
        case 'place': this.noise('effects', 0.18, { f: 500, q: 0.8, vol: 0.18 }); this.tone('effects', 220, 0.15, { type: 'sine', vol: 0.12, to: 140 }); break;
        case 'remove': this.noise('effects', 0.22, { f: 900, fTo: 300, q: 1, vol: 0.14 }); break;
        case 'mist': this.noise('effects', 1.1, { ft: 'highpass', f: 3500, vol: 0.12, att: 0.15 }); break;
        case 'pounce': this.noise('effects', 0.12, { f: 2500, fTo: 900, q: 2, vol: 0.12 }); break;
        // natural strike: a soft body-thud into the substrate, a scuffle of legs, and (for flyers) a few frantic wingbeats that cut off
        case 'strike': case 'strikeFly':
          this.noise('ambience', 0.09, { ft: 'lowpass', f: 380, vol: 0.16, att: 0.004 });
          this.noise('ambience', 0.22, { f: 2600, q: 0.9, vol: 0.05, att: 0.01, delay: 0.03 });
          this.noise('ambience', 0.12, { f: 4200, q: 1.2, vol: 0.025, delay: 0.16 });
          if (name === 'strikeFly') this.tone('ambience', 230 + Math.random() * 40, 0.45, { type: 'sawtooth', vol: 0.02, att: 0.01, lp: 900, vib: 23, vibAmt: 60, delay: 0.04 });
          break;
        case 'catch': this.tone('effects', 660, 0.12, { type: 'triangle', vol: 0.1 }); this.tone('effects', 990, 0.18, { type: 'triangle', vol: 0.08, delay: 0.07 }); break;
        case 'rustle': this.noise('effects', 0.35, { f: 1800, q: 0.6, vol: 0.07, att: 0.08 }); break;
        case 'journal': [523, 659, 784].forEach((f, i) => this.tone('effects', f, 0.5, { type: 'sine', vol: 0.07, delay: i * 0.09 })); break;
        case 'molt': this.tone('effects', 392, 1.2, { type: 'sine', vol: 0.07, att: 0.3, vib: 4, vibAmt: 3 }); break;
        case 'error': this.tone('effects', 200, 0.18, { type: 'square', vol: 0.04, lp: 900 }); break;
        // fingertip on the glass: a soft knuckle-on-glass tok with a faint ring
        case 'glass': this.noise('effects', 0.06, { ft: 'lowpass', f: 900, vol: 0.09, att: 0.003 }); this.tone('effects', 1850 + Math.random() * 120, 0.32, { type: 'sine', vol: 0.012, att: 0.004 }); break;
        case 'touch': this.tone('effects', 520, 0.14, { type: 'sine', vol: 0.03, att: 0.02, to: 600 }); break;
        case 'startle': this.noise('effects', 0.16, { f: 3400, fTo: 1800, q: 1.4, vol: 0.06, att: 0.004 }); this.noise('effects', 0.1, { f: 2600, q: 1.4, vol: 0.04, delay: 0.09 }); break;
        case 'curious': this.tone('effects', 1320, 0.09, { type: 'sine', vol: 0.025, att: 0.01 }); this.tone('effects', 1760, 0.12, { type: 'sine', vol: 0.02, att: 0.01, delay: 0.08 }); break;
        case 'unlock': [523, 659, 784, 1047].forEach((f, i) => this.tone('effects', f, 0.6, { type: 'triangle', vol: 0.06, delay: i * 0.08, lp: 3000 })); this.swell(0.5); break;
        case 'escape': this.noise('effects', 0.25, { f: 1400, fTo: 3200, q: 1, vol: 0.06 }); this.tone('effects', 330, 0.2, { type: 'triangle', vol: 0.04, to: 220, delay: 0.05 }); break;
        case 'feed': for (let i = 0; i < 4; i++) this.noise('effects', 0.05, { f: 2200 + Math.random() * 1500, q: 2, vol: 0.035, delay: i * 0.06 + Math.random() * 0.03 }); break;
        case 'land': this.noise('ambience', 0.07, { ft: 'lowpass', f: 600, vol: 0.06, att: 0.003 }); break;
        case 'hatch': [784, 988, 1175].forEach((f, i) => this.tone('effects', f, 0.35, { type: 'sine', vol: 0.05, delay: i * 0.07 })); break;
      }
    },
    // ---- lo-fi music: detuned electric piano, soft drums, vinyl crackle and tape wobble ----
    /** Signal path: notes -> lofi in -> soft saturation -> tape lowpass -> wobbling delay -> swell gain -> music bus. */
    _lofiChain(c) {
      const inp = c.createGain(), sat = c.createWaveShaper(), lp = c.createBiquadFilter(), wob = c.createDelay(0.1), out = c.createGain();
      const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; cv[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); } sat.curve = cv;
      lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.5; wob.delayTime.value = 0.016;
      for (const [f, a] of [[0.33, 0.0016], [5.3, 0.00016]]) { const l = c.createOscillator(), g = c.createGain(); l.frequency.value = f; g.gain.value = a; l.connect(g); g.connect(wob.delayTime); l.start(); }
      inp.gain.value = 1.5; inp.connect(sat); sat.connect(lp); lp.connect(wob); wob.connect(out); out.connect(this.buses.music);
      this.buses.lofi = inp; this._lo = { lp, out, swell: 0, bar: 0, n: 0, prog: null, crackle: null };
      // vinyl: sparse pops and dust over faint hiss, looped
      const len = c.sampleRate * 4, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.018;
      for (let k = 0; k < 70; k++) { const at = Math.floor(Math.random() * (len - 60)), amp = (Math.random() < 0.15 ? 0.9 : 0.35) * (Math.random() < 0.5 ? -1 : 1); for (let j = 0; j < 40; j++) d[at + j] += amp * Math.exp(-j / 5) * (j % 2 ? -0.6 : 1); }
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true; const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100; const vg = c.createGain(); vg.gain.value = 0;
      src.connect(hp); hp.connect(vg); vg.connect(this.buses.music); src.start(); this._lo.crackle = vg;
    },
    /** gentle lift on catches, molts and journal moments */
    swell(a) { if (this._lo) { this._lo.swell = Math.min(1, this._lo.swell + a); this._lo.lift = true; } },
    // hand-written loops as MIDI voicings: [bass, ...chord]
    LOFI: {
      day: [
        [[38, 53, 57, 60, 64], [43, 53, 59, 64, 69], [36, 52, 55, 59, 62], [45, 55, 61, 65, 67]],   // Dm9  G13  Cmaj9  A7b13
        [[41, 57, 60, 64, 67], [40, 55, 59, 62, 64], [45, 55, 59, 60, 64], [43, 53, 57, 60, 62]],   // Fmaj9  Em7  Am9  G9sus
        [[36, 52, 55, 59, 62], [45, 55, 60, 64, 67], [38, 53, 57, 60, 64], [43, 53, 59, 62, 65]],   // Cmaj9  Am7  Dm9  G7
      ],
      night: [
        [[45, 55, 59, 60, 64], [41, 52, 57, 59, 64], [38, 53, 57, 60, 64], [40, 50, 56, 59, 65]],   // Am9  Fmaj7#11  Dm9  E7b9
        [[38, 53, 57, 60, 64], [45, 55, 59, 60, 64], [46, 50, 53, 57, 62], [40, 50, 56, 59, 62]],   // Dm9  Am9  Bbmaj7  E7
      ],
      day_mel: [69, 72, 74, 76, 79, 81, 84], night_mel: [64, 67, 69, 72, 74, 76],
    },
    _ep(t, m, vol, dur) { // detuned Rhodes-ish voice: two slightly detuned sines + a quick bell-like tine
      const f = 440 * Math.pow(2, (m - 69) / 12), dl = Math.max(0, t - this.ctx.currentTime);
      this.tone('lofi', f * 0.9975, dur, { type: 'sine', vol, att: 0.012, delay: dl });
      this.tone('lofi', f * 1.0025, dur * 0.9, { type: 'sine', vol: vol * 0.8, att: 0.012, delay: dl });
      this.tone('lofi', f * 2, 0.5, { type: 'sine', vol: vol * 0.28, att: 0.004, delay: dl });
    },
    _lofi(game, night) {
      const c = this.ctx, L = this._lo, now = c.currentTime, nt = night > 0.5, bpm = nt ? 62 : 74, beat = 60 / bpm;
      // continuous parameters: brighter tape by day, quieter in observe mode, swell decays
      const dtt = Math.min(0.5, now - (L._last || now)); L._last = now; L.swell = Math.max(0, L.swell - dtt * 0.12);
      const obs = root.JT && JT.UI && JT.UI.obs; const day = 1 - night;
      if (!L._tk || now - L._tk > 0.2) { L._tk = now;
        L.lp.frequency.setTargetAtTime(1150 + day * 1500 + L.swell * 900, now, 0.6);
        L.out.gain.setTargetAtTime((obs ? 0.5 : 1) * (1 + L.swell * 0.45), now, 0.8);
        L.crackle.gain.setTargetAtTime(nt ? 0.07 : 0.045, now, 1);
      }
      if (L.bar < now - 1) L.bar = now + 0.15; // first start or returning from background
      if (L.bar - now > 0.35) return;
      // schedule one bar
      const t0 = L.bar, rnd = Math.random;
      if (L.night !== nt) L.n = 0;
      if (!L.prog || L.n % 8 === 0) { const P = this.LOFI[nt ? 'night' : 'day']; L.prog = P[Math.floor(rnd() * P.length)]; L.night = nt; }
      const ch = L.prog[L.n % 4], sw = beat * 0.16; // swing
      const cv = nt ? 0.022 : 0.026;
      ch.slice(1).forEach((m, i) => this._ep(t0 + i * 0.022 + rnd() * 0.01, m, cv * (1 - i * 0.08), beat * 3.6));
      if (rnd() < (nt ? 0.35 : 0.6)) ch.slice(2).forEach((m, i) => this._ep(t0 + beat * 2.5 + sw + i * 0.018, m, cv * 0.55, beat * 1.2)); // push
      const bf = 440 * Math.pow(2, (ch[0] - 69) / 12), dl = (x) => Math.max(0, x - now);
      this.tone('lofi', bf, beat * 1.8, { type: 'triangle', vol: 0.075, att: 0.02, lp: 320, delay: dl(t0) });
      this.tone('lofi', bf * (rnd() < 0.5 ? 1.5 : 1), beat * 1.2, { type: 'triangle', vol: 0.055, att: 0.02, lp: 320, delay: dl(t0 + beat * 2) });
      // soft drums (day: kick, brushed snare, swung hats; night: kick and rim only)
      const kick = (x, v) => this.tone('lofi', 95, 0.28, { type: 'sine', vol: v, att: 0.004, to: 42, delay: dl(x) });
      kick(t0, nt ? 0.09 : 0.12); if (!nt) kick(t0 + beat * 2.5 + sw, 0.07); if (!nt && rnd() < 0.4) kick(t0 + beat * 1.5 + sw, 0.05);
      if (!nt) { for (const b of [1, 3]) this.noise('lofi', 0.2, { f: 1700, q: 0.7, vol: 0.05, att: 0.006, delay: dl(t0 + beat * b) });
        for (let e = 0; e < 8; e++) if (e % 2 === 0 || rnd() < 0.5) this.noise('lofi', 0.04, { ft: 'highpass', f: 7000, vol: e % 2 ? 0.012 : 0.02, att: 0.002, delay: dl(t0 + e * beat / 2 + (e % 2 ? sw : 0)) }); }
      else { this.noise('lofi', 0.05, { f: 2400, q: 3, vol: 0.03, delay: dl(t0 + beat * 3) });
        if (this.set.ambience > 0.01) for (const b of [0.5, 2.5]) if (rnd() < 0.6) for (let i = 0; i < 3; i++) this.tone('ambience', 4300 + rnd() * 150, 0.045, { type: 'sine', vol: 0.018, delay: dl(t0 + beat * b + i * 0.08) }); } // crickets
      // occasional short melody (always after a swell)
      if (L.lift || rnd() < (nt ? 0.22 : 0.32)) {
        const sc = this.LOFI[nt ? 'night_mel' : 'day_mel']; let k = Math.floor(rnd() * (sc.length - 2)); const len = 3 + Math.floor(rnd() * 3); let x = t0 + beat * (rnd() < 0.5 ? 1 : 2);
        for (let i = 0; i < len; i++) { const f = 440 * Math.pow(2, (sc[k] - 69) / 12); this.tone('lofi', f, beat * 0.9, { type: 'triangle', vol: L.lift ? 0.04 : 0.03, att: 0.015, lp: 1900, vib: 4.5, vibAmt: 2.5, delay: dl(x) }); x += beat * (rnd() < 0.6 ? 0.5 : 1) + (i % 2 ? 0 : sw * 0.5); k = Math.max(0, Math.min(sc.length - 1, k + (rnd() < 0.5 ? -1 : 1) * (1 + Math.floor(rnd() * 2)))); }
        L.lift = false;
      }
      L.bar = t0 + beat * 4; L.n++;
    },
    // ---- tank soundscapes ----
    /* Each tank sounds like where its jumpers come from (rainforest drips and insects, desert wind, garden birds by day
       and crickets at night, woodland breeze), and like what is in it: a water dish trickles, lots of plants rustle,
       misting hisses and drips for a while, a basking lamp hums. Key moments (catches, molts, journal) sound the same
       everywhere. Continuous beds are a few looped noise filters; everything else is tiny scheduled one-shots. */
    _beds(c) {
      const len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const bed = (type, f, q) => { const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = Math.random(); const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; src.connect(fl); fl.connect(g); g.connect(this.buses.ambience); src.start(0, Math.random() * 2); return { fl, g }; };
      const hum = c.createGain(); hum.gain.value = 0; hum.connect(this.buses.ambience);
      for (const [f, a] of [[100, 1], [200, 0.45], [300, 0.15]]) { const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.value = a; o.connect(g); g.connect(hum); o.start(); }
      this._sc = { wind: bed('lowpass', 420, 0.7), hiss: bed('bandpass', 5200, 0.6), rustle: bed('bandpass', 2600, 0.8), water: bed('bandpass', 1400, 1.4), mist: bed('highpass', 4200, 0.5), rain: bed('bandpass', 3000, 0.45), rumble: bed('lowpass', 150, 0.7), hum, t: 0, ev: {}, theme: null, k: 0 };
    },
    _bedsQuiet() { const S = this._sc; if (!S || S.quiet) return; const t = this.ctx.currentTime; for (const k of ['wind', 'hiss', 'rustle', 'water', 'mist', 'rain', 'rumble']) if (S[k]) S[k].g.gain.setTargetAtTime(0, t, 0.4); S.hum.gain.setTargetAtTime(0, t, 0.4); S.quiet = true; },
    /** Which soundscape a tank gets, from its substrate and backdrop. */
    themeOf(hab) {
      const d = hab.data, sub = d.substrate, bg = d.bg; if (d.sound && d.sound !== 'auto') return d.sound;
      if (d.biome && d.biome !== 'classic') { if (['desert','heath'].includes(d.biome)) return 'desert'; if (['rainforest','paludarium','cloudforest','antkingdom'].includes(d.biome)) return 'rainforest'; if (['urban','prairie'].includes(d.biome)) return 'garden'; return 'woodland'; }
      if (['desert', 'clay', 'beach', 'dune'].includes(sub) || (bg === 'twilight' && sub !== 'jungle')) return 'desert';
      if (['jungle', 'sphagnum', 'mud'].includes(sub) || bg === 'canopy') return 'rainforest';
      if (bg === 'meadow' || hab.decor.filter(x => { const D = JT.DECOR_BY_ID[x.type]; return D && (D.arche === 'flower' || D.flowers); }).length >= 2) return 'garden';
      return 'woodland';
    },
    /** What the tank's setup adds (counted at most every 2 s). */
    setupOf(hab) {
      let water = 0, plants = 0, lamps = 0;
      for (const x of hab.decor) { const D = JT.DECOR_BY_ID[x.type]; if (!D) continue; if (D.water) water++; if (D.cat === 'plants') plants++; if (x.type === 'heatlamp' && x.on !== false) lamps++; }
      return { water, plants, lamps, drops: hab.data.drops.length };
    },
    _scape(dt, game, night) {
      const S = this._sc, hab = game.hab; if (!S || !hab) return; const c = this.ctx, now = c.currentTime, R = Math.random; S.quiet = false;
      S.k -= dt; if (S.k <= 0 || S.hab !== hab) { S.k = 2; S.hab = hab; S.theme = this.themeOf(hab); S.set = this.setupOf(hab); }
      const th = S.theme, st = S.set, day = 1 - night, obs = root.JT && JT.UI && JT.UI.obs ? 0.8 : 1;
      const mistOn = hab._mistAt != null && hab.time - hab._mistAt < 5 ? 1 - (hab.time - hab._mistAt) / 5 : 0;
      const WF = root.JT && JT.app && JT.app.R && JT.app.R._wxF, wf = WF && WF.hab === hab ? WF.f : null; // v19: rain sound follows the visual fade
      const rainA = wf ? Math.min(1, (wf.rain || 0) + (wf.storm || 0)) : 0, stormA = wf ? wf.storm || 0 : 0;
      // continuous beds (eased)
      S.t -= dt; if (S.t <= 0) { S.t = 0.25; const tc = 0.6, g = (n, v) => S[n].g.gain.setTargetAtTime(v * obs, now, tc);
        const gust = 0.5 + 0.5 * Math.sin(now * 0.21) * Math.sin(now * 0.077 + 1);
        g('wind', th === 'desert' ? 0.05 + gust * 0.09 : th === 'woodland' ? 0.012 + gust * 0.02 : th === 'garden' ? 0.01 + gust * 0.012 : 0.006);
        S.wind.fl.frequency.setTargetAtTime(th === 'desert' ? 260 + gust * 700 : 380 + gust * 300, now, 1.2);
        g('hiss', th === 'rainforest' ? 0.012 + night * 0.006 : 0.002);
        g('rustle', Math.min(0.035, Math.max(0, st.plants - 3) * 0.004) * (0.4 + gust * 0.9));
        g('water', st.water ? 0.008 + Math.min(2, st.water) * 0.004 : 0);
        g('mist', mistOn * 0.05); if (S.rain) { g('rain', rainA * rainA * (0.03 + 0.025 * stormA)); g('rumble', stormA * stormA * 0.035); }
        S.hum.gain.setTargetAtTime(st.lamps ? Math.min(2, st.lamps) * 0.0045 * obs : 0, now, 0.8); }
      // one-shots
      const E = S.ev, due = (k, lo, hi) => { E[k] = (E[k] == null ? lo * R() : E[k]) - dt; if (E[k] > 0) return false; E[k] = lo + R() * (hi - lo); return true; };
      const drip = (v, f) => { f = f || 900 + R() * 900; this.tone('ambience', f, 0.12, { type: 'sine', vol: v, att: 0.003, to: f * 1.6 }); this.tone('ambience', f * 2.1, 0.05, { type: 'sine', vol: v * 0.3, att: 0.002, delay: 0.01 }); };
      const chirp = (base, n, v) => { for (let i = 0; i < n; i++) this.tone('ambience', base + R() * 400, 0.07 + R() * 0.05, { type: 'sine', vol: v, att: 0.01, to: base * (1.2 + R() * 0.5), delay: i * (0.09 + R() * 0.05) }); };
      const crickets = (v) => { const f = 4200 + R() * 300; for (let i = 0; i < 3 + (R() * 3 | 0); i++) this.tone('ambience', f, 0.045, { type: 'sine', vol: v, delay: i * 0.085 }); };
      if (th === 'rainforest') {
        if (due('drip', 0.6, 2.4 - mistOn * 1.8)) drip(0.03 + R() * 0.02);
        if (day > 0.5 && due('cicada', 9, 22)) { const d0 = 2.5 + R() * 3; this.tone('ambience', 5200 + R() * 600, d0, { type: 'sawtooth', vol: 0.006, att: 0.8, lp: 7000, vib: 48 + R() * 20, vibAmt: 260 }); }
        if (night > 0.5 && due('frog', 4, 11)) { const f = 260 + R() * 120; for (let i = 0; i < 2 + (R() * 3 | 0); i++) this.tone('ambience', f, 0.11, { type: 'sawtooth', vol: 0.012, att: 0.01, lp: 700, delay: i * 0.22 }); }
        if (night > 0.4 && due('crk', 1.5, 4)) crickets(0.02);
        if (day > 0.5 && due('bird', 10, 26)) chirp(1800, 3, 0.012);
      } else if (th === 'desert') {
        if (due('sand', 3, 9)) this.noise('ambience', 0.6 + R(), { f: 5200, q: 0.7, vol: 0.012, att: 0.3 });
        if (night > 0.5 && due('crk', 3, 8)) crickets(0.014);
        if (day > 0.5 && due('tick', 6, 16)) for (let i = 0; i < 3; i++) this.noise('ambience', 0.02, { f: 3800, q: 3, vol: 0.02, delay: i * 0.07 });
      } else if (th === 'garden') {
        if (day > 0.45 && due('bird', 2.5, 7)) { const pat = R(); if (pat < 0.5) chirp(2600, 2 + (R() * 4 | 0), 0.018); else { const f = 2200 + R() * 1200; this.tone('ambience', f, 0.35, { type: 'sine', vol: 0.014, att: 0.02, to: f * 1.4, vib: 22, vibAmt: 140 }); } }
        if (day > 0.5 && due('bee', 14, 30)) this.tone('ambience', 220 + R() * 40, 2 + R() * 2, { type: 'sawtooth', vol: 0.006, att: 0.6, lp: 900, vib: 6, vibAmt: 10 });
        if (night > 0.4 && due('crk', 0.9, 2.2)) crickets(0.022);
        if (night > 0.6 && due('owl', 30, 70)) { this.tone('ambience', 410, 0.5, { type: 'sine', vol: 0.014, att: 0.08 }); this.tone('ambience', 370, 0.7, { type: 'sine', vol: 0.012, att: 0.08, delay: 0.7 }); }
      } else {
        if (day > 0.5 && due('bird', 6, 16)) chirp(2200, 2 + (R() * 3 | 0), 0.012);
        if (night > 0.4 && due('crk', 1.6, 4.5)) crickets(0.016);
        if (due('scut', 5, 12)) this.noise('ambience', 0.25, { f: 3000, q: 1.5, vol: 0.015 });
      }
      if (rainA > 0.05 && due('rdrop', 0.04 / rainA, 0.22 / rainA)) drip((0.004 + R() * 0.008) * rainA, 1500 + R() * 2600); // patter on leaves
      if (stormA > 0.6 && due('thunder', 20, 50)) this.noise('ambience', 3 + R() * 2.5, { ft: 'lowpass', f: 190, fTo: 55, vol: 0.1 * stormA, att: 0.35, delay: R() * 0.5 });
      // setup-reactive one-shots: dish trickle, mist drips, prey in the tank
      if (st.water && due('trk', 0.35, 1.3)) drip(0.012 + R() * 0.01, 1300 + R() * 1400);
      if (mistOn > 0 && due('mdrip', 0.15, 0.6)) drip(0.03 * mistOn + 0.01);
      if (st.drops > 4 && due('ddrip', 2, 6)) drip(0.016);
      const prey = hab.prey;
      if (prey.some(p => p.sup && p.sup.k === 'air') && due('fly', 6, 14)) this.tone('ambience', 180 + R() * 60, 0.9 + R(), { type: 'sawtooth', vol: 0.01, att: 0.3, lp: 700, vib: 9, vibAmt: 18 });
      if (prey.some(p => p.type === 'cricket') && due('pcrk', 3, 8)) crickets(0.02);
    },
    // ---- generative music + ambience ----
    update(dt, game) {
      if (!this.started || !game) return; const s = this.set; if (s.muted) return;
      const night = 1 - game.daylight();
      if (s.music > 0.01) this._lofi(game, night);
      if (s.ambience > 0.01) this._scape(dt, game, night); else this._bedsQuiet();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
