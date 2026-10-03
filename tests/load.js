// Loads simulation modules into Node (no DOM) for headless tests.
const path = require('path');
['core', 'data', 'geometry', 'nav', 'world', 'spider', 'prey', 'presets', 'game', 'camera'].forEach(f => { try { require(path.join(__dirname, '..', 'js', f + '.js')); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; } });
module.exports = globalThis.JT;
