/* Terrarium (combined app): the ⋯ menu gets "Switch to …" and "Title screen". Each game keeps its own save. */
(function (root) {
  'use strict';
  const JT = root.JT; if (!JT || !JT.UI || typeof document === 'undefined') return;
  const mantis = !!(root.JT_PACK && root.JT_PACK.id === 'mantis');
  const other = mantis ? { url: 'jumper.html', name: 'Jumping Spiders' } : { url: 'mantis.html', name: 'Mantises' };
  const go = (url) => { try { JT.app && JT.app.game && JT.app.game.save(); } catch (e) {} try { localStorage.setItem('terrarium.last', url === 'index.html' ? (mantis ? 'mantis.html' : 'jumper.html') : url); } catch (e) {} location.href = url; };
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
  root.JT_COMBINED = true;
})(typeof window !== 'undefined' ? window : globalThis);
