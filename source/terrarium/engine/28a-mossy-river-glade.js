/* Historical mossy-only patch, retained for reference. Not loaded by order.json; superseded by 28b-miniature-worlds.js. */
/* Mossy River Glade — living scenery rework, October 2026.
 * Cosmetic only: no habitat collision, navigation, save format or simulation changes.
 * Loaded after the renderer and before boot. Other background IDs use the original renderer.
 */
(function (root) {
  'use strict';
  const J = root.JT;
  if (!J || !J.GLPaint || !J.GLMesh) return;
  const G = J.GLMesh, M = J.M, TAU = Math.PI * 2, UP = [0, 1, 0], ZERO = [0, 0, 0];
  const rgb = G.rgb, mix = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
  const C = {
    soil: ['#55583a','#626243','#4d5733','#73704a','#626e3c','#454d30'].map(rgb),
    rock: ['#777967','#656b5e','#858575','#6b7160'].map(rgb),
    moss: ['#7c8b40','#667b36','#92994a','#536b33','#a1a354'].map(rgb),
    leaf: ['#768e3f','#91a54e','#596f32','#abb365'].map(rgb),
    bark: rgb('#65523a'), barkShade: rgb('#3d392a'), water: rgb('#486f69')
  };
  // The existing selection key stays 'mossy', so saved worlds pick up the rework.
  Object.assign(J.BACKGROUNDS.mossy, {
    sky: ['#303f32','#708369','#a5ac7b'],
    blobs: ['#3e5135','#5c7040','#7b8a4c','#9aa15d','#b4b878'],
    ground: '#58623c', fog: '#8a9879', light: '#f0e7b0',
    near: ['#34432d','#536138'], shafts: 0.26
  });

  // Draw once, upload once: a seamless woodland panorama, not the old bokeh washes.
  const paintings = Object.create(null);
  function panorama(layer) {
    if (paintings[layer]) return paintings[layer];
    const c = document.createElement('canvas'); c.width = 2048; c.height = 1024;
    const g = c.getContext('2d'), W = c.width, H = 768;
    g.scale(1, c.height / H);
    const r = J.makeRng(J.hashStr('mossy-glade-painted-' + layer));
    const pick = a => a[Math.floor(r()*a.length)];
    const oval = (x,y,rx,ry,col,angle) => {g.fillStyle=col;g.beginPath();g.ellipse(x,y,rx,ry,angle||0,0,TAU);g.fill();};
    // Stamp the same object at either seam; orbiting never exposes a hard image edge.
    const wrap = (x, fn) => {for (const d of [-W,0,W]) {g.save();g.translate(x+d,0);fn();g.restore();}};
    if (layer === 'far') {
      const sky = g.createLinearGradient(0,0,0,H);
      sky.addColorStop(0,'#596f5b');sky.addColorStop(.46,'#9da987');sky.addColorStop(1,'#69764b');
      g.fillStyle=sky;g.fillRect(0,0,W,H);
      for(let band=0;band<3;band++) {
        for(let i=0;i<23;i++) {
          const x=r()*W, h=300+r()*360, w=12+r()*24;
          wrap(x,()=>{
            g.fillStyle=['#7f927a','#6f856b','#5f7558'][band];
            g.beginPath();g.moveTo(-w,H);g.bezierCurveTo(-w*.6,470,-w*.2,260,-w*.5,H-h);
            g.lineTo(w*.4,H-h);g.bezierCurveTo(w*.15,300,w*.3,520,w,H);g.fill();
            g.strokeStyle=['#7d9077','#6b815f','#647953'][band];g.lineWidth=w*.38;
            for(let k=0;k<3;k++) {g.beginPath();g.moveTo(0,H-h*.35-k*34);g.quadraticCurveTo(50,300-k*40,90+k*40,150+k*33);g.stroke();}
          });
        }
        for(let i=0;i<240;i++) {
          const x=r()*W,y=r()*410;
          wrap(x,()=>oval(0,y,20+r()*65,12+r()*34,pick(['#647b55','#758955','#8b995e','#9aa46b','#506d50'])));
        }
      }
      const light=g.createRadialGradient(W*.47,90,10,W*.47,110,650);
      light.addColorStop(0,'rgba(243,234,175,.40)');light.addColorStop(1,'rgba(219,229,183,0)');
      g.fillStyle=light;g.fillRect(0,0,W,H);
      for(let i=0;i<4600;i++) {
        const x=r()*W,y=r()*H;
        oval(x,y,1+r()*5,1+r()*2,pick(['rgba(231,223,159,.07)','rgba(29,57,35,.05)','rgba(165,183,121,.08)']),r());
      }
    } else {
      g.clearRect(0,0,W,H);
      for(let i=0;i<19;i++) {
        const x=(i+.2+r()*.6)*W/19,w=10+r()*25;
        wrap(x,()=>{
          g.fillStyle=pick(['#3d523a','#4d6041','#596646','#46583b']);
          g.beginPath();g.moveTo(-w*1.8,H);g.bezierCurveTo(-w*.3,500,-w*.7,140,-w*.4,-20);
          g.lineTo(w*.6,-20);g.bezierCurveTo(w*.3,170,w*.5,530,w*1.8,H);g.closePath();g.fill();
          g.strokeStyle='rgba(167,164,112,.24)';g.lineWidth=2;
          for(let k=0;k<4;k++){g.beginPath();g.moveTo(-w*.4+k*w*.3,700);g.bezierCurveTo(-w*.1,490,w*.2,240,k*w*.14,40);g.stroke();}
          for(let k=0;k<5;k++)oval((r()-.5)*w*2,480+r()*250,4+r()*10,8+r()*20,'rgba(94,119,52,.5)');
        });
      }
      for(let i=0;i<460;i++) {
        const x=r()*W,y=r()*210;
        wrap(x,()=>oval(0,y,9+r()*39,5+r()*17,pick(['#3d5737','#5b713c','#798d48','#99a257','#657d41']),r()-.5));
      }
      for(let i=0;i<100;i++) {
        const x=r()*W,y=600+r()*168;
        wrap(x,()=>{
          oval(0,y,18+r()*47,15+r()*32,pick(['#53603d','#657247','#7a814d']));
          for(let k=0;k<5;k++)oval((r()-.5)*36,y-10-r()*14,5+r()*13,3+r()*7,pick(['#7f8b46','#8d9851','#5f743c']));
        });
      }
      // Let the distant layer and scene lighting breathe through the middle.
      g.globalCompositeOperation='destination-in';
      const fade=g.createLinearGradient(0,0,0,H);
      fade.addColorStop(0,'rgba(0,0,0,.82)');fade.addColorStop(.5,'rgba(0,0,0,.40)');fade.addColorStop(1,'rgba(0,0,0,.92)');
      g.fillStyle=fade;g.fillRect(0,0,W,H);g.globalCompositeOperation='source-over';
    }
    paintings[layer]=c; return c;
  }

  function upload(p, mb) {
    const verts=new Float32Array(mb.v), idx=mb.n>65000?new Uint32Array(mb.i):new Uint16Array(mb.i);
    const lv=new Float32Array(mb.lines.length*4*15);
    const li=mb.lines.length*4>65000?new Uint32Array(mb.lines.length*6):new Uint16Array(mb.lines.length*6);
    mb.lines.forEach((s,i)=>{
      const [a,b,w,alpha,col]=s;
      [[-1,0],[1,0],[1,1],[-1,1]].forEach(([sd,en],j)=>lv.set([...a,...b,sd,en,w,alpha,...(col||C.barkShade),0,0],(i*4+j)*15));
      const k=i*4;li.set([k,k+1,k+2,k,k+2,k+3],i*6);
    });
    const m={verts,idx,n:mb.n,lines:lv,lidx:li,nl:mb.lines.length,u32:idx instanceof Uint32Array,
      vb:p.buf(verts),ib:p.buf(idx,'idx'),lb:lv.length?p.buf(lv):null,lib:li.length?p.buf(li,'idx'):null};
    m.del=[m.vb,m.ib];if(m.lb)m.del.push(m.lb,m.lib);return m;
  }
  function build(p,hab) {
    const W=hab.dims.w,D=hab.dims.d,S=Math.max(W,D,150), cx=W/2,cz=D/2;
    const Y=-18.35,r=J.makeRng(J.hashStr('river-glade-v1-'+W+'-'+D));
    const mb=new G.MB({height:200,baseY:Y}), pick=a=>a[Math.floor(r()*a.length)];
    const x0=cx-S*3.5,x1=cx+S*3.5,z0=cz-S*3.1,z1=cz+S*3.1;
    const stream=x=>-D*.9-S*.16+Math.sin((x-cx)/S*1.45)*S*.12+Math.sin(x/S*3.1)*S*.035;
    const width=x=>S*(.13+.024*Math.sin(x/S*1.9));
    const inTank=(x,z,pad=0)=>x>-pad&&x<W+pad&&z>-pad&&z<D+pad;
    const inWater=(x,z,pad=0)=>Math.abs(z-stream(x))<width(x)+pad;
    const vert=(pos,col,f,n)=>mb.vert(pos,n||UP,ZERO,col,col,f==null?G.TWO+G.PAT.moss:f);
    const patch=(a,b,c,d,col,mat)=>{const ids=[a,b,c,d].map(v=>vert(v,col,mat));mb.quad(...ids);};
    const flat=(x,z,rx,rz,col,y)=>G.ell(mb,[x,y==null?Y+.02:y,z],[rx,0,0],[0,.09,0],[0,0,rz],col,col,G.TWO,null,9,2,true,0);
    // Continuous, gently mottled forest floor. The stream is a cut-out, not a blue rectangle over it.
    for(let i=0;i<62;i++) {
      const a=x0+(x1-x0)*i/62,b=x0+(x1-x0)*(i+1)/62;
      for(const side of [-1,1]) {
        const bankA=stream(a)+side*width(a),bankB=stream(b)+side*width(b);
        const end=side<0?z0:z1,rows=side<0?17:25;
        for(let k=0;k<rows;k++) {
          const za=bankA+(end-bankA)*k/rows,zb=bankB+(end-bankB)*k/rows;
          const za2=bankA+(end-bankA)*(k+1)/rows,zb2=bankB+(end-bankB)*(k+1)/rows;
          const base=rgb('#656d47'),noise=(r()-.5)*.045,shade=.02*Math.sin((a+b)/(S*2.3)+(k+.5)*.7);
          const col=base.map(v=>M.clamp(v+noise+shade,0,1));
          patch([a,Y,za],[b,Y,zb],[b,Y,zb2],[a,Y,za2],col,G.TWO);
        }
      }
      for(let q=0;q<5;q++) {
        const t=q/5,t1=(q+1)/5;
        const za=stream(a)-width(a)+2*width(a)*t,zb=stream(b)-width(b)+2*width(b)*t;
        const za2=stream(a)-width(a)+2*width(a)*t1,zb2=stream(b)-width(b)+2*width(b)*t1;
        const col=mix(C.water,rgb('#829080'),(.15+r()*.28)+(q===0||q===4?.06:0));
        patch([a,Y-.8,za],[b,Y-.8,zb],[b,Y-.8,zb2],[a,Y-.8,za2],col,G.TWO+G.PAT.speck);
      }
    }
    // Soft contact stains under the plinth, not a separate rectangular apron.
    for(let i=0;i<38;i++) {
      const edge=i%4,t=r();let x,z;
      if(edge===0){x=t*W;z=-1;}if(edge===1){x=t*W;z=D+1;}
      if(edge===2){x=-1;z=t*D;}if(edge===3){x=W+1;z=t*D;}
      flat(x,z,9+r()*9,5+r()*5,rgb('#42482f'));
    }
    function rock(x,z,sx,sy,sz,moss=true) {
      const c=pick(C.rock),ms=pick(C.moss),phase=r()*TAU,N=10,K=5,rows=[];
      for(let j=0;j<=K;j++) {
        const v=j/K*Math.PI/2,row=[];
        for(let i=0;i<=N;i++) {
          const a=i/N*TAU,wob=1+.13*Math.sin(a*3+phase)+.07*Math.cos(a*5-phase);
          const nx=Math.cos(a)*Math.cos(v),ny=Math.sin(v),nz=Math.sin(a)*Math.cos(v);
          const pos=[x+sx*nx*wob,Y+sy*ny*(.92+.08*Math.sin(a*2+phase)),z+sz*nz*wob];
          const n=M.norm([nx/sx,ny/sy,nz/sz]);
          const green=moss?M.clamp((ny-.4+.19*Math.sin(a*4+phase))*2.5,0,1):0;
          const col=mix(mix(c,rgb('#a2a184'),.1+.12*Math.sin(a*2+phase)),ms,green);
          row.push(mb.vert(pos,n,M.mul(n,.25),col,mix(c,C.moss[1],.3),G.PAT.speck));
        }rows.push(row);
      }
      for(let j=0;j<K;j++)for(let i=0;i<N;i++)mb.quad(rows[j][i],rows[j][i+1],rows[j+1][i+1],rows[j+1][i]);
      // Tiny uneven moss cushions break up the silhouette.
      if(moss&&sx>10)for(let k=0;k<3;k++) {
        const a=r()*TAU;G.ell(mb,[x+Math.cos(a)*sx*.38,Y+sy*.83,z+Math.sin(a)*sz*.38],[sx*.25,0,0],[0,sy*.16,0],[0,0,sz*.24],pick(C.moss),C.moss[3],G.PAT.moss,null,7,3,true,.1);
      }
    }
    // The low stones at the habitat foot never invade its usable floor.
    for(let i=0;i<24;i++) {
      const side=i%4,t=r();let x,z;
      if(side===0){x=t*W;z=-7-r()*7;}if(side===1){x=t*W;z=D+6+r()*8;}
      if(side===2){x=-8-r()*9;z=t*D;}if(side===3){x=W+8+r()*9;z=t*D;}
      rock(x,z,3+r()*6,2+r()*5,3+r()*5,i%3!==0);
    }
    // Riverbank boulders, asymmetric clusters, and a few half-submerged stones.
    for(let i=0;i<51;i++) {
      const x=cx+(r()-.5)*S*5.5,side=i%2?1:-1;
      const z=stream(x)+side*(width(x)+5+r()*24),s=9+r()*22;
      rock(x,z,s,s*(.45+r()*.45),s*(.7+r()*.45),true);
    }
    for(const [x,z,s] of [[-S*.24,D*.35,22],[W+S*.22,D*.05,30],[-S*.38,D+S*.64,35],[W+S*.4,D+S*.58,37]])rock(x,z,s,s*.62,s*.8,true);
    for(let i=0;i<12;i++){
      const x=cx+(r()-.5)*S*3.8,z=stream(x)+(r()-.5)*width(x)*1.2;
      rock(x,z,4+r()*8,2+r()*6,4+r()*8,i%3===0);
    }
    // Leaf litter and gravel. Deterministic and built once per habitat geometry, never simulated.
    for(let i=0;i<410;i++) {
      const x=cx+(r()-.5)*S*3.7,z=cz+(r()-.5)*S*3;
      if(inTank(x,z,3)||inWater(x,z,3))continue;
      const rad=.65+r()*2.5,green=r()<.52;
      G.ell(mb,[x,Y+.08,z],[rad,0,0],[0,rad*.36,0],[0,0,rad*.72],green?pick(C.moss):pick(C.rock),green?C.moss[3]:C.rock[1],G.PAT.speck,null,6,2,true,0);
    }
    function leaf(a,b,w,col,mat) {
      const dir=M.sub(b,a),side=M.norm(M.cross(dir,UP));
      if(M.len(side)<.1)return;
      const mid=M.lerp3(a,b,.48),l=M.add(mid,M.mul(side,w)),rr=M.sub(mid,M.mul(side,w));
      const ridge=M.add(mid,[0,w*.12,0]);
      const ai=vert(a,col,mat||G.TWO),bi=vert(b,col,mat||G.TWO);
      const li=vert(l,mix(col,C.leaf[3],.12),mat||G.TWO),ri=vert(rr,mix(col,C.leaf[2],.18),mat||G.TWO),mi=vert(ridge,col,mat||G.TWO);
      mb.tri(ai,li,mi);mb.tri(li,bi,mi);mb.tri(bi,ri,mi);mb.tri(ri,ai,mi);
    }
    for(let i=0;i<85;i++) {
      const x=cx+(r()-.5)*S*2.6,z=cz+(r()-.5)*S*2.4;
      if(inTank(x,z,5)||inWater(x,z,2))continue;
      const a=r()*TAU,len=3+r()*6,col=rgb(['#a18c4f','#8d743e','#b29c57','#786b40'][i%4]);
      leaf([x,Y+.23,z],[x+Math.cos(a)*len,Y+.3,z+Math.sin(a)*len],len*.3,col);
    }
    function fern(x,z,h,angle) {
      for(let f=0;f<5;f++) {
        const a=angle+f*TAU/5,dx=Math.cos(a),dz=Math.sin(a),L=h*(.68+r()*.4);
        const at=t=>[x+dx*L*t*.67,Y+L*(1.42*t-.77*t*t),z+dz*L*t*.67];
        G.tube(mb,[at(0),at(.33),at(.66),at(1)],.23,.08,C.leaf[1],C.leaf[2],0,4,false,0);
        for(let j=1;j<=9;j++) {
          const t=j/10,p0=at(t),len=L*.22*Math.sin(t*Math.PI)*(.65+.35*t);
          for(const sign of [-1,1]) {
            const tip=[p0[0]-dz*len*sign+dx*len*.38,p0[1]+len*.13,p0[2]+dx*len*sign+dz*len*.38];
            leaf(p0,tip,len*.21,pick(C.leaf));
          }
        }
      }
    }
    const fernSpots=[[-24,12,28],[W+25,D*.2,38],[-38,D+26,36],[W+38,D+38,40],[-16,-38,33],[W+16,-42,37]];
    for(let i=0;i<22;i++) {
      const x=cx+(r()-.5)*S*4.5,z=stream(x)+(i%2?1:-1)*(width(x)+28+r()*38);
      if(!inTank(x,z,28))fernSpots.push([x,z,22+r()*25]);
    }
    for(const [x,z,h] of fernSpots)fern(x,z,h,r()*TAU);
    // Low clover / round leaves between stones, keeping the central clearing quieter.
    for(let i=0;i<110;i++) {
      const x=cx+(r()-.5)*S*2.9,z=cz+(r()-.5)*S*2.7;
      if(inTank(x,z,10)||inWater(x,z,8))continue;
      for(let k=0;k<3;k++) {
        const a=k*TAU/3,s=1.1+r()*1.7;
        G.disc(mb,[x+Math.cos(a)*s,Y+.7,z+Math.sin(a)*s],[s,0,0],[0,.3,s*.8],UP,pick(C.moss),G.TWO,6,0);
      }
    }
    // Fallen wood on the far bank: proper cylindrical bark, sawn end rings and moss.
    const logA=[cx-S*1.12,Y+17,stream(cx-S*.9)-S*.55],logB=[cx-S*.16,Y+36,stream(cx-S*.16)-S*.56];
    const logPts=[logA,M.lerp3(logA,logB,.34),M.lerp3(logA,logB,.68),logB];
    G.tube(mb,logPts,17,13,C.bark,C.barkShade,G.PAT.grain,11,rgb('#9e8a5d'),.35);
    const axis=M.norm(M.sub(logB,logA)),side=M.norm(M.cross(axis,UP)),rise=M.norm(M.cross(side,axis));
    for(let k=0;k<9;k++) {
      const a=k*TAU/9,off=M.add(M.mul(side,Math.cos(a)*17.1),M.mul(rise,Math.sin(a)*17.1));
      mb.polyline(logPts.map((v,i)=>M.add(v,M.mul(off,1-i*.07))),.5,.46,C.barkShade);
    }
    for(let k=0;k<14;k++) {
      const t=r(),v=M.lerp3(logA,logB,t);
      G.ell(mb,[v[0],v[1]+13,v[2]],[4+r()*5,0,0],[0,2+r()*2,0],[0,0,4+r()*4],pick(C.moss),C.moss[3],G.PAT.moss,null,7,3,true,.1);
    }
    // Rooted trunks behind the stream. No tall foreground object can hide the playing area.
    for(let i=0;i<9;i++) {
      const x=cx+(i-4)*S*.48+(r()-.5)*S*.16,z=stream(x)-S*(.93+r()*.5),h=S*(.8+r()*.6),rad=9+r()*10;
      const pts=[[x,Y,z],[x+rad*.1,Y+h*.4,z+rad*.3],[x-rad*.3,Y+h,z-rad*.6]];
      G.tube(mb,pts,rad*1.35,rad*.65,rgb('#5d6044'),rgb('#3b4935'),G.PAT.grain,8,true,.12);
      for(let k=0;k<4;k++) {
        const a=r()*TAU;
        G.tube(mb,[[x,Y+10,z],[x+Math.cos(a)*rad*1.6,Y+2,z+Math.sin(a)*rad*1.6],[x+Math.cos(a)*rad*3.2,Y,z+Math.sin(a)*rad*3.2]],rad*.44,.3,C.bark,C.barkShade,G.PAT.grain,5,true,.1);
      }
    }
    // Short, broken sky reflections are part of the water mesh, not a frame loop.
    // They remain visible in every renderer/refresh cycle and follow the river's curve.
    for(let i=0;i<150;i++) {
      const x=cx+(r()-.5)*S*5.6,offset=(r()-.5)*1.72,len=2.6+r()*8.2,w=.14+r()*.16;
      const a=x-len*.5,b=x+len*.5,za=stream(a)+width(a)*offset,zb=stream(b)+width(b)*offset;
      const col=mix(C.water,rgb('#bac8ad'),.16+r()*.37);
      patch([a,Y-.62,za-w],[b,Y-.62,zb-w],[b,Y-.62,zb+w],[a,Y-.62,za+w],col,G.TWO);
    }
    const mesh=upload(p,mb);
    mesh.gladeStats={vertices:mb.n,triangles:mb.i.length/3,ferns:fernSpots.length,ripples:150,version:'1.0'};
    return mesh;
  }
  const P=J.GLPaint.prototype, oldBG=P.bgTexture,oldGround=P.buildGroundAnchor;
  P.bgTexture=function(id) {
    if((id||'mossy')!=='mossy')return oldBG.call(this,id);
    this.bgT=this.bgT||{};if(this.bgT.mossy)return this.bgT.mossy;
    const gl=this.gl,tex=c=>{
      const t=this.texFrom(c,false);gl.bindTexture(gl.TEXTURE_2D,t);
      // POT canvases allow seamless repeat in WebGL 1 as well as WebGL 2.
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);return t;
    };
    const far=tex(panorama('far')),mid=tex(panorama('mid'));
    return this.bgT.mossy={far,mid,t:far,B:J.BACKGROUNDS.mossy,glade:true};
  };
  P.buildGroundAnchor=function(hab) {return (hab.data.bg||'mossy')==='mossy'?build(this,hab):oldGround.call(this,hab);};
  J.MossyGlade={version:'1.0',panorama,build,cosmeticOnly:true};
})(typeof window!=='undefined'?window:globalThis);
