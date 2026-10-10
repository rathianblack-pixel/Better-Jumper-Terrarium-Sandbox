/* Terrarium (combined app):
   - the ⋯ menu gets "Switch to …" and "Title screen". Each game keeps its own save.
   - there is one title screen (index.html): the game's own start screen and its live showcase are skipped, so the game
     opens straight into your tank (faster: no second throwaway game is built and simulated).
   - now and then (and when you leave) a small picture of your tank is kept for the title screen's background and card. */
(function (root) {
  'use strict';
  const JT = root.JT; if (!JT || !JT.UI || typeof document === 'undefined') return;
  const mantis = !!(root.JT_PACK && root.JT_PACK.id === 'mantis'), id = mantis ? 'mantis' : 'jumper';
  const other = mantis ? { url: 'jumper.html', name: 'Jumping Spiders' } : { url: 'mantis.html', name: 'Mantises' };
  { const sp = document.getElementById('splash'); if (sp) sp.remove(); } // before boot: the game starts without its own splash

  /* ---- tank picture for the title screen ---- */
  const SHOT_KEY = 'terrarium.shot.' + id;
  const snap = (cb) => {
    const A = JT.app, R = A && A.R; const fin = () => { if (cb) { const f = cb; cb = null; f(); } };
    if (!R || R.attract || JT.UI.photo || R._cap || document.hidden) { fin(); return; }
    let done = false; const to = setTimeout(() => { if (!done) { done = true; if (R._cap === cap) R._cap = null; fin(); } }, 450);
    const cap = (glc, cv) => { done = true; clearTimeout(to);
      try { const W0 = (glc || cv).width, H0 = (glc || cv).height, sc = Math.min(1, 1100 / Math.max(W0, H0)), W = Math.round(W0 * sc), H = Math.round(H0 * sc);
        if (W > 64 && H > 64) { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.fillStyle = '#0b120a'; x.fillRect(0, 0, W, H);
          if (glc) x.drawImage(glc, 0, 0, W, H); if (cv) x.drawImage(cv, 0, 0, W, H);
          const u = c.toDataURL('image/jpeg', 0.72); const art = (JT.HD2D && JT.HD2D.art) || 'hd2d';
          try { localStorage.setItem(SHOT_KEY, JSON.stringify({ u, art, t: Date.now() })); } catch (e) { try { localStorage.removeItem(SHOT_KEY); } catch (e2) { void e2; } } } } catch (e) { void e; }
      fin(); };
    R._cap = cap;
  };
  JT.TitleShot = snap; // for tests

  const go = (url) => { try { JT.app && JT.app.game && JT.app.game.save(); } catch (e) {} try { localStorage.setItem('terrarium.last', mantis ? 'mantis.html' : 'jumper.html'); if (url !== 'index.html') localStorage.setItem('terrarium.last', url); } catch (e) {}
    document.body.style.transition = 'opacity .3s'; snap(() => { document.body.style.opacity = '0'; setTimeout(() => { location.href = url; }, 280); }); };
  const more0 = JT.UI.moreSheet;
  JT.UI.moreSheet = function () {
    const r = more0.apply(this, arguments);
    const menu = document.querySelector('#modalBody .menu') || document.getElementById('modalBody'); if (!menu) return r;
    const sec = document.createElement('div'); sec.className = 'msect'; sec.setAttribute('data-noterm', '');
    sec.innerHTML = '<h4>Terrarium</h4>';
    const row = (lab, hint, fn) => { const b = document.createElement('button'); b.className = 'mrow'; b.innerHTML = lab + '<small>' + hint + '</small>'; b.onclick = fn; sec.appendChild(b); };
    row('Switch to ' + other.name, 'Your ' + (mantis ? 'mantis' : 'spider') + ' tanks are saved and wait here', () => go(other.url));
    row('Title screen', 'Back to the Terrarium start screen', () => go('index.html'));
    menu.insertBefore(sec, menu.firstChild);
    return r;
  };

  /* ---- after boot (this listener runs after the engine's): fade from the title picture into the live tank ---- */
  const after = () => {
    let n = 0; const t0 = performance.now();
    const tick = () => { n++; if (n < 6 || performance.now() - t0 < 300) { requestAnimationFrame(tick); return; } if (root.TR_VEIL) root.TR_VEIL.out(); };
    requestAnimationFrame(tick);
    setTimeout(() => snap(), 7000);
    setInterval(() => { if (!document.hidden) snap(); }, 120000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', after); else setTimeout(after, 0);
  root.JT_COMBINED = true;
})(typeof window !== 'undefined' ? window : globalThis);
