/* Mantis Terrarium pack v1.2 — profile shows female / male (and carrying eggs, elderly). */
(function (root) {
  'use strict';
  const JT = root.JT;
  // ---- profile: female / male ----
  if (JT.UI && JT.UI.profileModal) {
    const pm0 = JT.UI.profileModal;
    JT.UI.profileModal = function (sp) {
      const r = pm0.apply(this, arguments);
      try { const e = typeof document !== 'undefined' && document.querySelector('.pf-st'); if (e && sp && (sp.sex === 'f' || sp.sex === 'm') && !e.dataset.msex) { e.dataset.msex = 1; e.textContent += ' \u00b7 ' + (sp.sex === 'f' ? 'Female' : 'Male') + (sp.gravid ? ' (carrying eggs)' : '') + (sp.elderNoted ? ' \u00b7 elderly' : ''); } } catch (e) { /* ignore */ }
      return r;
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
