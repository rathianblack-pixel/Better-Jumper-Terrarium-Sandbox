const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: process.env.CHROME, args: ['--no-sandbox'] }); const p = await b.newPage({ viewport: { width: 390, height: 844 } });
 await p.goto('file:///data/terrarium/dist/terrarium/index.html#pick'); await p.waitForTimeout(900); await p.screenshot({ path: '/data/comb_phone.png' }); await b.close(); })();
