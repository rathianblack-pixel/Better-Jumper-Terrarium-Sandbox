/* Mantis Terrarium pack — wording. Engine UI text says "jumper"; the mantis build shows "mantis" everywhere
   (text nodes, titles, toasts), leaving species names and code untouched. */
(function (root) {
  'use strict';
  const JT = root.JT; if (typeof document === 'undefined') return;
  const RULES = [[/Jumping spiders/g, 'Mantises'], [/jumping spiders/g, 'mantises'], [/Jumping spider/g, 'Mantis'], [/jumping spider/g, 'mantis'],
    [/Jumper Terrarium/g, 'Mantis Terrarium'], [/JUMPERS/g, 'MANTISES'], [/JUMPER/g, 'MANTIS'], [/Jumpers/g, 'Mantises'], [/jumpers/g, 'mantises'], [/Jumper/g, 'Mantis'], [/jumper/g, 'mantis'],
    [/Tiny Slings/g, 'Hatchlings'], [/Tiny Sling/g, 'Hatchling'], [/Slings/g, 'Nymphs'], [/Sling/g, 'Nymph'], [/slings/g, 'nymphs'], [/sling/g, 'nymph'],
    [/\bspiders\b/g, 'mantises'], [/\bspider\b/g, 'mantis'], [/\bSpiders\b/g, 'Mantises'], [/\bSpider\b/g, 'Mantis'],
    [/\bpalps\b/g, 'antennae'], [/\bfangs\b/g, 'jaws'], [/\bsilk\b/g, 'twigs'], [/\bfront eyes\b/g, 'eyes'], [/\bleap\b/g, 'strike'], [/\bpounce\b/g, 'strike'], [/\bpounces\b/g, 'strikes'], [/\bjumps\b/g, 'strikes'], [/\bjump\b/g, 'strike']];
  const fix = (s) => { if (!s || !/[JjSs]|JUMPER|palps|fangs|silk|leap|pounce|jump/.test(s)) return s; let o = s; for (const [a, b] of RULES) o = o.replace(a, b); return o; };
  JT.term = fix;
  const walk = (node) => {
    if (node.nodeType === 3) { const pe = node.parentNode; if (pe && (pe.tagName === 'SCRIPT' || pe.tagName === 'STYLE' || (pe.closest && pe.closest('[data-noterm]')))) return; const v = fix(node.nodeValue); if (v !== node.nodeValue) node.nodeValue = v; return; }
    if (node.nodeType !== 1 || (node.hasAttribute && node.hasAttribute('data-noterm')) || node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'CANVAS') return;
    for (const a of ['title', 'aria-label', 'placeholder']) { const v = node.getAttribute && node.getAttribute(a); if (v) { const w = fix(v); if (w !== v) node.setAttribute(a, w); } }
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  };
  const start = () => { walk(document.body); new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') walk(m.target); else for (const n of m.addedNodes) walk(n); if (m.type === 'attributes') walk(m.target); } }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'aria-label', 'placeholder'] }); document.title = root.JT_COMBINED ? 'Terrarium' : 'Mantis Terrarium'; };
  if (document.body) start(); else addEventListener('DOMContentLoaded', start);
})(typeof window !== 'undefined' ? window : globalThis);
