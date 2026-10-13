/* Mantis Terrarium pack v1.2 — save migration: sex for old saves, egg-case sanity. Loaded after the game state (09). */
(function (root) {
  'use strict';
  const JT = root.JT; if (!JT || !JT.Game) return;
  const M = JT.M; const rndSex = () => (JT.R() < 0.5 ? 'f' : 'm');
  // old saves: every mantis (tanks + holding cup) gets a sex; egg cases are checked
  if (JT.Game && JT.Game.migrate) {
    const mig0 = JT.Game.migrate;
    JT.Game.migrate = function (d) {
      d = mig0.call(this, d) || d;
      const fix = (s) => { if (s && s.sex !== 'f' && s.sex !== 'm') s.sex = rndSex(); };
      for (const h of d.habitats || []) { for (const s of h.spiders || []) fix(s); if (h.ooth && !Array.isArray(h.ooth)) h.ooth = []; if (Array.isArray(h.ooth)) h.ooth = h.ooth.filter(o => o && JT.SPECIES_BY_ID[o.species] && M.finite3(o.pos)); }
      for (const s of d.cup || []) fix(s);
      return d;
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
