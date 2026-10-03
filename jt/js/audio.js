/* Jumper Terrarium — procedural WebAudio: calm generative music, sparse creature ambience, effects.
   No samples, no rain. Three independent buses (Music / Ambience / Effects). */
(function (root) {
  'use strict';
  const JT = root.JT;
  const Audio = JT.Audio = {
    ctx: null, buses: {}, started: false, set: null, _musT: 0, _ambT: 0, _chord: 0,
    init(settings) { this.set = settings; },
    start() {
      if (this.started) { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = root.AudioContext || root.webkitAudioContext; if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      const c = this.ctx; this.master = c.createGain(); this.master.connect(c.destination);
      const comp = c.createDynamicsCompressor(); comp.connect(this.master);
      // gentle feedback-delay "room" for music
      this.delay = c.createDelay(1.5); this.delay.delayTime.value = 0.42; const fb = c.createGain(); fb.gain.value = 0.32; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      this.delay.connect(lp); lp.connect(fb); fb.connect(this.delay); lp.connect(comp);
      for (const k of ['music', 'ambience', 'effects']) { const g = c.createGain(); g.connect(comp); this.buses[k] = g; }
      this.buses.music.connect(this.delay);
      this.started = true; this.apply();
    },
    apply() { if (!this.started) return; const s = this.set; const t = this.ctx.currentTime; this.master.gain.setTargetAtTime(s.muted ? 0 : 0.9, t, 0.05); this.buses.music.gain.setTargetAtTime(s.music * 0.5, t, 0.1); this.buses.ambience.gain.setTargetAtTime(s.ambience * 0.6, t, 0.1); this.buses.effects.gain.setTargetAtTime(s.effects * 0.8, t, 0.05); },
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
      switch (name) {
        case 'click': this.tone('effects', 880, 0.08, { type: 'triangle', vol: 0.08 }); break;
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
        case 'coin': this.tone('effects', 1318, 0.12, { type: 'sine', vol: 0.09 }); this.tone('effects', 1760, 0.22, { type: 'sine', vol: 0.08, delay: 0.08 }); break;
        case 'rustle': this.noise('effects', 0.35, { f: 1800, q: 0.6, vol: 0.07, att: 0.08 }); break;
        case 'journal': [523, 659, 784].forEach((f, i) => this.tone('effects', f, 0.5, { type: 'sine', vol: 0.07, delay: i * 0.09 })); break;
        case 'molt': this.tone('effects', 392, 1.2, { type: 'sine', vol: 0.07, att: 0.3, vib: 4, vibAmt: 3 }); break;
        case 'error': this.tone('effects', 200, 0.18, { type: 'square', vol: 0.04, lp: 900 }); break;
      }
    },
    // ---- generative music + ambience ----
    update(dt, game) {
      if (!this.started || !game) return; const s = this.set; if (s.muted) return;
      const night = 1 - game.daylight();
      this._musT -= dt;
      if (s.music > 0.01 && this._musT <= 0) {
        // slow pentatonic phrases over soft pads (D major pentatonic; lower and sparser at night)
        const roots = [146.83, 123.47, 164.81, 110]; const r = roots[this._chord % roots.length];
        if (Math.random() < 0.55) { this._chord++; [1, 1.5, 2, 2.5].forEach((m, i) => this.tone('music', r * m, 5.5, { type: 'sine', vol: 0.035 - i * 0.005, att: 1.6, lp: 900 })); }
        const scale = [293.66, 329.63, 369.99, 440, 493.88, 587.33, 659.25];
        const notes = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < notes; i++) { const f = scale[Math.floor(Math.random() * scale.length)] * (night > 0.5 ? 0.5 : 1); this.tone('music', f, 1.8, { type: 'triangle', vol: 0.045, att: 0.02, lp: 2400, delay: i * (0.35 + Math.random() * 0.3) }); }
        this._musT = 2.6 + Math.random() * 3.2;
      }
      this._ambT -= dt;
      if (s.ambience > 0.01 && this._ambT <= 0) {
        const hab = game.hab; const prey = hab ? hab.prey : []; const has = (id) => prey.some(p => p.type === id);
        const r = Math.random();
        if ((night > 0.4 || has('cricket')) && r < 0.45) { for (let i = 0; i < 3; i++) this.tone('ambience', 4200 + Math.random() * 200, 0.05, { type: 'sine', vol: 0.03, delay: i * 0.09 }); }
        else if (prey.some(p => p.sup && p.sup.k === 'air') && r < 0.75) this.tone('ambience', 180 + Math.random() * 60, 0.9 + Math.random(), { type: 'sawtooth', vol: 0.012, att: 0.3, lp: 700, vib: 9, vibAmt: 18 });
        else if (r < 0.88) this.noise('ambience', 0.25, { f: 3000, q: 1.5, vol: 0.02 }); // tiny scuttle
        else this.tone('ambience', night > 0.5 ? 380 : 2200 + Math.random() * 900, 0.25, { type: 'sine', vol: 0.015, vib: 30, vibAmt: 80 }); // distant bird / frog
        this._ambT = 2 + Math.random() * 5;
      }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
