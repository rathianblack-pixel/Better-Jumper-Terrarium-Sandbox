/* Rebuild the jumper-only release using its editable shared engine and page shell. */
const fs=require('fs'),path=require('path');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const copy=(a,b)=>{fs.mkdirSync(b,{recursive:true});for(const name of fs.readdirSync(a)){const from=path.join(a,name),to=path.join(b,name);fs.statSync(from).isDirectory()?copy(from,to):fs.copyFileSync(from,to)}};
const out=path.join(__dirname,'dist/terrarium');fs.rmSync(out,{recursive:true,force:true});copy(path.join(__dirname,'packs/terrarium/static'),out);
fs.copyFileSync(path.join(__dirname,'packs/terrarium/launcher.html'),path.join(out,'index.html'));
let head=read('packs/jumper/shell/head.html').replace('<body>','<body>\n'+read('packs/terrarium/early.html'));
const scripts=JSON.parse(read('engine/order.json')).scripts,parts=[head,'<script>window.JT_COMBINED=true;</script>'];
for(const item of scripts){if(item.gap)parts.push(...item.gap);else parts.push('<script>\n'+read('engine/'+item)+'\n</script>')}
parts.push('<script>\n'+read('packs/terrarium/switch.js')+'\n</script>',read('packs/jumper/shell/tail.html'));
fs.writeFileSync(path.join(out,'jumper.html'),parts.join('\n'));
const sw=path.join(out,'sw.js');fs.writeFileSync(sw,fs.readFileSync(sw,'utf8').replace(/const CACHE='[^']+'/g,"const CACHE='tr-jumper-"+Date.now().toString(36)+"'"));
console.log('Built jumper-only release: dist/terrarium');
