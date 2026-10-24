

(function () {
  "use strict";

  const FACE_HEX = {
    U: "#f2f4f7",
    D: "#f7d117",
    F: "#22c568",
    B: "#1358c4",
    R: "#ed3541",
    L: "#f07a17",
  };
  const PALETTES = Object.freeze({classic:{...FACE_HEX},...(window.CubeSkins?.palettes||{})});
  const COLOR_FACE=Object.freeze(Object.fromEntries(Object.entries(FACE_HEX).map(([face,hex])=>[hex,face])));
  let paletteId="classic",paletteRevision=0;
  function setPalette(id){if(window.CubeSkins){if(!CubeSkins.isKnown(id))return false;id=CubeSkins.normalize(id);}if(!Object.prototype.hasOwnProperty.call(PALETTES,id))return false;if(id!==paletteId){paletteId=id;paletteRevision++;;}return true;}
  function displayColor(hex){const face=COLOR_FACE[hex];return face?PALETTES[paletteId][face]:hex;}
  const NUM_TO_FACE = ["F", "B", "U", "D", "L", "R"];
  const INNER = "#0f1216";
  const PLASTIC = "#191d24";
  const GUIDE_SINGLE = "#12ec79", GUIDE_DOUBLE = "#a674ff";
  const ERROR_HEX = "#e5484d";
  const FACE_CN = { U: "上", D: "下", F: "前", B: "后", L: "左", R: "右" };

  function toHex(v) {
    if (typeof v === "string") {
      if (v.startsWith("#")) return v;
      v = parseInt(v, 10);
    }
    if (typeof v !== "number" || isNaN(v)) return INNER;
    const face = NUM_TO_FACE[v];
    return (face && FACE_HEX[face]) || INNER;
  }

  const rot = (v, axis, ang) => {
    const [x, y, z] = v, c = Math.cos(ang), s = Math.sin(ang);
    if (axis === "x") return [x, y * c - z * s, y * s + z * c];
    if (axis === "y") return [x * c + z * s, y, -x * s + z * c];
    return [x * c - y * s, x * s + y * c, z];
  };

  const FACES = ["U", "D", "F", "B", "R", "L"];

  function newCubies() {
    const out = [];
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          if (x === 0 && y === 0 && z === 0) continue;

          const sticker = {};
          for (const f of FACES) {
            const n = FACE_N0[f];

            const onSurface = n[0] !== 0 ? x === n[0] : n[1] !== 0 ? y === n[1] : z === n[2];
            sticker[f] = onSurface ? FACE_HEX[f] : INNER;
          }
          out.push({

            x, y, z,

            local: {
              U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1],
              B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0],
            },
            sticker,
          });
        }
    return out;
  }

  const FACE_N0 = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1],
                    B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };

  function allOrientations() {
    const base = { U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1],
                   B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0] };
    const seen = new Map();
    const axes = ["x", "y", "z"];
    for (const a1 of axes) for (let i1 = 0; i1 < 4; i1++)
      for (const a2 of axes) for (let i2 = 0; i2 < 4; i2++) {
        const o = {};
        for (const k of FACES) {
          let v = base[k];
          v = rot(v, a1, i1 * Math.PI / 2);
          v = rot(v, a2, i2 * Math.PI / 2);
          o[k] = v.map(Math.round);
        }

        const key = FACES.map(k => o[k].join("")).join("");
        seen.set(key, o);
      }
    return [...seen.values()];
  }

  function fits(sticker, ori, want) {
    for (const k of FACES) {
      const col = sticker[k];
      if (col === INNER) continue;
      const d = ori[k];
      const worldFace = FACES.find(f =>
        FACE_N0[f][0] === d[0] && FACE_N0[f][1] === d[1] && FACE_N0[f][2] === d[2]);
      if (!worldFace || want[worldFace] !== col) return false;
    }
    return true;
  }

  function facePos(face, a, b) {
    switch (face) {
      case "U": return [b - 1, 1, a - 1];
      case "D": return [b - 1, -1, 1 - a];
      case "F": return [b - 1, 1 - a, 1];
      case "B": return [1 - b, 1 - a, -1];
      case "R": return [1, 1 - a, 1 - b];
      case "L": return [-1, 1 - a, b - 1];
      default: return [0, 0, 0];
    }
  }

  const MOVE_SPEC = {
    U: { axis: "y", layer: 1,  sign: -1 },
    D: { axis: "y", layer: -1, sign: 1 },
    R: { axis: "x", layer: 1,  sign: -1 },
    L: { axis: "x", layer: -1, sign: 1 },
    F: { axis: "z", layer: 1,  sign: -1 },
    B: { axis: "z", layer: -1, sign: 1 },
  };

  function moveAngle(move) {
    const sp = MOVE_SPEC[move[0]];
    if (!sp) return 0;
    const prime = move.includes("'");
    const quarters = move.endsWith("2") ? 2 : 1;
    return (Math.PI / 2) * sp.sign * (prime ? -1 : 1) * quarters;
  }

  const VIEW_DEFAULT = { yaw: -0.62, pitch: 0.46 };

  const VIEW_RESET = { yaw: 0, pitch: 0 };

  const TURN_MS = 70;
  const MAX_VISUAL_LAG = 80;

  function depthRenderer(canvas) {
    let gl;
    try { gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'})||canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'}); } catch (_) { return null; }
    if (!gl || typeof gl.createShader!=='function' || typeof gl.VERTEX_SHADER!=='number') return null;
    let program,buffer,position,color,cameraUniform,scaleUniform,lost=false,vertices=new Float32Array(32768);
    const matrix=new Float32Array(9);let skinRenderer=null,skinFailed=false;
    function init() {
      skinRenderer=null;skinFailed=false;
      const shader=(kind,code)=>{
        if(typeof WebGL2RenderingContext!=="undefined"&&gl instanceof WebGL2RenderingContext){
          code=kind===gl.VERTEX_SHADER?'#version 300 es\n'+code.replace(/\battribute\b/g,'in').replace(/\bvarying\b/g,'out'):'#version 300 es\nprecision mediump float;out vec4 cubeOutput;\n'+code.replace(/\bvarying\b/g,'in').replace(/gl_FragColor/g,'cubeOutput');
        }
        const s=gl.createShader(kind);gl.shaderSource(s,code);gl.compileShader(s);
        if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));
        return s;
      };
      const v=shader(gl.VERTEX_SHADER,'attribute vec4 a_position;attribute vec3 a_color;uniform mat3 u_camera;uniform vec2 u_scale;varying lowp vec3 v_color;void main(){vec3 c=u_camera*a_position.xyz;float d=7.2-c.z-a_position.w;gl_Position=vec4(c.xy*u_scale,(21.0*d-40.0)/19.0,d);v_color=a_color;}');
      const f=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying lowp vec3 v_color;void main(){gl_FragColor=vec4(v_color,1.0);}');
      program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);
      gl.deleteShader(v);gl.deleteShader(f);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
      buffer=gl.createBuffer();position=gl.getAttribLocation(program,'a_position');color=gl.getAttribLocation(program,'a_color');
      cameraUniform=gl.getUniformLocation(program,'u_camera');scaleUniform=gl.getUniformLocation(program,'u_scale');
    }
    init();
    canvas.addEventListener?.('webglcontextlost',e=>{e.preventDefault();skinRenderer?.dispose();skinRenderer=null;lost=true;});
    canvas.addEventListener?.('webglcontextrestored',()=>{init();lost=false;});
    return {
      draw(faces,camera,focal,w,h){
        if(lost)return;
        if(paletteId==="classic"&&skinRenderer){skinRenderer.dispose();skinRenderer=null;}
        if(paletteId!=="classic"&&window.CubeSkins&&!skinFailed){
          try{skinRenderer??=CubeSkins.createRenderer(gl);skinRenderer.draw(faces,camera,focal,w,h,paletteId);return;}
          catch(error){skinFailed=true;skinRenderer?.dispose();skinRenderer=null;console.warn("CubeDesk material fallback",error.message);}
        }
        let count=0;
        const sx=2*focal*Math.min(w,h)*.42/w,sy=2*focal*Math.min(w,h)*.42/h;
        function vertex(p,rgb,bias=0){
          if(count+7>vertices.length){const next=new Float32Array(vertices.length*2);next.set(vertices);vertices=next;}
          vertices[count++]=p[0];vertices[count++]=p[1];vertices[count++]=p[2];vertices[count++]=bias;
          vertices[count++]=rgb[0];vertices[count++]=rgb[1];vertices[count++]=rgb[2];
        }
        for(const face of faces){
          const rgb=face.rgb,pts=face.pts;
          for(let i=1;i+1<pts.length;i++){vertex(pts[0],rgb);vertex(pts[i],rgb);vertex(pts[i+1],rgb);}
          if(face.rim){
            const center=[0,0,0];for(const p of pts){center[0]+=p[0];center[1]+=p[1];center[2]+=p[2];}
            center[0]/=pts.length;center[1]/=pts.length;center[2]/=pts.length;
            const inner=pts.map(p=>[p[0]*.95+center[0]*.05,p[1]*.95+center[1]*.05,p[2]*.95+center[2]*.05]);
            for(let i=0;i<pts.length;i++){
              const j=(i+1)%pts.length;
              for(const p of [pts[i],pts[j],inner[j],pts[i],inner[j],inner[i]])vertex(p,face.rim,.001);
            }
          }
        }
        gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clearDepth(1);
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);

        for(let row=0;row<3;row++)for(let column=0;column<3;column++)matrix[column*3+row]=camera[row][column];
        gl.uniformMatrix3fv(cameraUniform,false,matrix);gl.uniform2f(scaleUniform,sx,sy);
        gl.bufferData(gl.ARRAY_BUFFER,vertices.subarray(0,count),gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,4,gl.FLOAT,false,28,0);
        gl.enableVertexAttribArray(color);gl.vertexAttribPointer(color,3,gl.FLOAT,false,28,16);
        gl.drawArrays(gl.TRIANGLES,0,count/7);
      },
      info(){return skinRenderer?.info()||{cpuBufferBytes:vertices.byteLength,gpuBufferBytes:0,textures:0};},
      dispose(){if(!lost){skinRenderer?.dispose();gl.deleteBuffer(buffer);gl.deleteProgram(program);}}
    };
  }

  function create(canvas) {
    const gpu=depthRenderer(canvas);
    const context2d=gpu?null:canvas.getContext?.("2d");
    let poseEnabled=false,poseReference=null,lastPose=null,poseCurrent=[1,0,0,0],poseTarget=[1,0,0,0],poseTick=0;
    const conjugate=q=>[q[0],-q[1],-q[2],-q[3]];
    const multiply=(a,b)=>[a[0]*b[0]-a[1]*b[1]-a[2]*b[2]-a[3]*b[3],a[0]*b[1]+a[1]*b[0]+a[2]*b[3]-a[3]*b[2],a[0]*b[2]-a[1]*b[3]+a[2]*b[0]+a[3]*b[1],a[0]*b[3]+a[1]*b[2]-a[2]*b[1]+a[3]*b[0]];
    function poseVector(v){if(!poseEnabled)return v;return multiply(multiply(poseCurrent,[0,...v]),conjugate(poseCurrent)).slice(1);}
    function setOrientation(q,enabled=true){
      if(poseEnabled!==!!enabled){poseEnabled=!!enabled;dirty=true;}
      if(!Array.isArray(q)||q.length!==4||!q.every(Number.isFinite)){
        if(poseReference){poseReference=null;lastPose=null;poseCurrent=poseTarget=[1,0,0,0];dirty=true;}return;
      }
      const length=Math.hypot(...q);if(length<.5||length>1.5)return;
      lastPose=q.map(v=>v/length);
      if(!poseReference){poseReference=[...lastPose];poseTick=performance.now();}
      poseTarget=multiply(conjugate(poseReference),lastPose);
    }
    function calibrateOrientation(){
      if(!lastPose)return false;
      poseReference=[...lastPose];poseCurrent=poseTarget=[1,0,0,0];dirty=true;return true;
    }
    function advancePose(now){
      if(!poseReference||!poseEnabled)return;
      const dt=Math.max(0,now-poseTick);poseTick=now;
      const sign=poseCurrent.reduce((n,v,i)=>n+v*poseTarget[i],0)<0?-1:1;
      if(Math.max(...poseCurrent.map((v,i)=>Math.abs(v-poseTarget[i]*sign)))<.0001){poseCurrent=poseTarget.map(v=>v*sign);return;}
      const k=1-Math.exp(-dt/28),q=poseCurrent.map((v,i)=>v+(poseTarget[i]*sign-v)*k),length=Math.hypot(...q);
      poseCurrent=q.map(v=>v/length);dirty=true;
    }
    let cubies = newCubies();
    let view = { ...VIEW_DEFAULT };
    let basis=[[1,0,0],[0,1,0],[0,0,1]],gripKey="U/F";
    const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
    const inGrip=p=>basis.map(row=>dot(row,p));
    const fromGrip=p=>[0,1,2].map(i=>basis.reduce((v,row,k)=>v+row[i]*p[k],0));
    let viewAnimation = 0;

    let intro = null;
    const guideMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : {matches:false};
    const reducedMotion = () => guideMotion.matches || (typeof document!=="undefined" && document.body.classList.contains("reduce-motion"));
    function cancelIntro(){intro=null;}
    function advanceIntro(){}
    function introPiece(){return null;}
    let queue = [];
    let anim = null;
    let guideMove = null, guideError = false;
    let errT0 = 0;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let cameraRows = [[1,0,0],[0,1,0],[0,0,1]];
    const cameraVector = p => [cameraRows[0][0]*p[0]+cameraRows[0][1]*p[1]+cameraRows[0][2]*p[2],cameraRows[1][0]*p[0]+cameraRows[1][1]*p[1]+cameraRows[1][2]*p[2],cameraRows[2][0]*p[0]+cameraRows[2][1]*p[1]+cameraRows[2][2]*p[2]];

    function fit() {
      const r = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 0, height: 0 };
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
      dirty = true;
    }

    function project(p, w, h) {

      const v = cameraVector(p);
      const D = 7.2;
      const f = guideMove ? 2.72 : 3.35;
      const z = D - v[2];
      const k = (f / z) * Math.min(w, h) * 0.42;
      return [w / 2 + v[0] * k, h / 2 - v[1] * k, v[2]];
    }

    function projQuad(pts, w, h) {
      const p = pts.map(q => project(q, w, h));
      const ax = p[1][0] - p[0][0], ay = p[1][1] - p[0][1];
      const bx = p[2][0] - p[0][0], by = p[2][1] - p[0][1];
      if (ax * by - ay * bx >= 0) return null;
      return p;
    }

    function fillPoly(c, p, fill, rim) {
      const ctx = c;
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (rim) {
        ctx.strokeStyle = rim;
        ctx.lineWidth = Math.max(1, dpr);
        ctx.stroke();
      }
    }

    function norm2(v) {
      const L = Math.hypot(v[0], v[1]) || 1;
      return [v[0] / L, v[1] / L];
    }

    function stickerFill(c, p, fill, rim) {
      const ctx = c;
      const inset = 0.16;
      const cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4;
      const cy = (p[0][1] + p[1][1] + p[2][1] + p[3][1]) / 4;
      const q = p.map(pt => [pt[0] + (cx - pt[0]) * inset, pt[1] + (cy - pt[1]) * inset]);
      let minE = Infinity;
      for (let i = 0; i < 4; i++) {
        const a = q[i], b = q[(i + 1) % 4];
        minE = Math.min(minE, Math.hypot(b[0] - a[0], b[1] - a[1]));
      }
      const r = Math.max(1, minE * 0.24);
      const Lp = [], Rp = [];
      for (let i = 0; i < 4; i++) {
        const prev = q[(i + 3) % 4], v = q[i], next = q[(i + 1) % 4];
        const dIn = norm2([prev[0] - v[0], prev[1] - v[1]]);
        const dOut = norm2([next[0] - v[0], next[1] - v[1]]);
        Lp.push([v[0] + dIn[0] * r, v[1] + dIn[1] * r]);
        Rp.push([v[0] + dOut[0] * r, v[1] + dOut[1] * r]);
      }
      ctx.beginPath();
      ctx.moveTo(Lp[0][0], Lp[0][1]);
      for (let i = 0; i < 4; i++) {
        ctx.quadraticCurveTo(q[i][0], q[i][1], Rp[i][0], Rp[i][1]);
        const j = (i + 1) % 4;
        ctx.lineTo(Lp[j][0], Lp[j][1]);
      }
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      if (rim) {
        ctx.strokeStyle = rim;
        ctx.lineWidth = Math.max(1, dpr);
        ctx.stroke();
      }
    }

    const S = 0.49;
    const QUAD_F = [[-S, -S, S], [S, -S, S], [S, S, S], [-S, S, S]];

    function orientQuad(n) {
      const [x, y, z] = n;
      if (z === 1) return QUAD_F;
      if (z === -1) return QUAD_F.map(q => [-q[0], q[1], -q[2]]);
      if (x === 1) return QUAD_F.map(q => [q[2], q[1], -q[0]]);
      if (x === -1) return QUAD_F.map(q => [-q[2], q[1], q[0]]);
      if (y === 1) return QUAD_F.map(q => [q[0], q[2], -q[1]]);
      return QUAD_F.map(q => [q[0], -q[2], q[1]]);
    }

    function orientPoint(q, n) {
      if (n[2] === 1) return q;
      if (n[2] === -1) return [-q[0], q[1], -q[2]];
      if (n[0] === 1) return [q[2], q[1], -q[0]];
      if (n[0] === -1) return [-q[2], q[1], q[0]];
      if (n[1] === 1) return [q[0], q[2], -q[1]];
      return [q[0], -q[2], q[1]];
    }
    function roundedRing(half, radius, z) {
      const points = [];
      for (let corner = 0; corner < 4; corner++) {
        const a = corner * Math.PI / 2;
        const cx = (corner === 0 || corner === 3 ? 1 : -1) * (half-radius);
        const cy = (corner < 2 ? 1 : -1) * (half-radius);
        for (let k = 0; k < 4; k++) {
          const angle = a + k*Math.PI/6;
          points.push([cx+radius*Math.cos(angle), cy+radius*Math.sin(angle),z]);
        }
      }
      return points;
    }

    const capRings = [0, Math.PI/4].map(a =>
      roundedRing(.42+.072*Math.sin(a), .098+.072*Math.sin(a), .42+.072*Math.cos(a)));
    const capMesh = [{pts:capRings[0], normal:[0,0,1]}];
    for (let ring = 0; ring < capRings.length-1; ring++) for (let i = 0; i < 16; i++) {
      const j=(i+1)%16, pts=[capRings[ring][i],capRings[ring+1][i],capRings[ring+1][j],capRings[ring][j]];
      const a=pts[1].map((v,k)=>v-pts[0][k]), b=pts[2].map((v,k)=>v-pts[0][k]);
      capMesh.push({pts, normal:norm(cross(a,b))});
    }

    const meshCache=new WeakMap();let skinMeshCache=new WeakMap(),skinMeshRevision=-1;
    const backingMesh={pts:roundedRing(.425,.06,.425),normal:[0,0,1],body:true};

    const atlasHomeCache=new WeakMap(),atlasOrientations=allOrientations();
    function atlasFace(c,name,alignedCenter){
      let home=atlasHomeCache.get(c);
      if(!home){
        const stickers=FACES.filter(f=>c.sticker[f]!==INNER).map(local=>({local,face:COLOR_FACE[c.sticker[local]]}));
        const pos=[0,0,0];for(const s of stickers)if(s.face)for(let k=0;k<3;k++)pos[k]+=FACE_N0[s.face][k];
        const orientation=atlasOrientations.find(o=>stickers.every(s=>s.face&&o[s.face].every((v,k)=>v===FACE_N0[s.local][k])))||atlasOrientations[0];
        home={pos,orientation};atlasHomeCache.set(c,home);
      }
      const face=COLOR_FACE[c.sticker[name]],p=home.pos;
      const tileUV=face==='F'?[p[0],p[1]]:face==='B'?[-p[0],p[1]]:face==='R'?[-p[2],p[1]]:face==='L'?[p[2],p[1]]:face==='U'?[p[0],-p[2]]:[p[0],p[2]];
      const tile=FACES.indexOf(face)*9+tileUV[0]+1+(1-tileUV[1])*3;
      const u=orientPoint([1,0,0],FACE_N0[face]),v=orientPoint([0,1,0],FACE_N0[face]);
      return {tile,uv(q){
        if(alignedCenter)return [q[0]/.96+.5,q[1]/.96+.5];
        const local=orientPoint(q,FACE_N0[name]),a=[home.orientation.R,home.orientation.U,home.orientation.F].map(axis=>dot(local,axis));
        return [dot(a,u)/.96+.5,dot(a,v)/.96+.5];
      }};
    }
    function meshForCubie(c){
      let cached=meshCache.get(c);
      if(!cached){
        cached=[];
        for(const name of FACES){
          const sticker=c.sticker[name]!==INNER;
          for(const facet of sticker?[backingMesh,...capMesh]:[backingMesh]){
            const transform=q=>localVector(orientPoint(q,FACE_N0[name]),c),localPts=facet.pts.map(transform);
            cached.push({localPts,pts:localPts.map(q=>[q[0]+c.x,q[1]+c.y,q[2]+c.z]),n:transform(facet.normal),
              uv:facet.pts.map(q=>[q[0]/.84+.5,q[1]/.84+.5]),color:facet.body?INNER:c.sticker[name],sticker:sticker&&!facet.body,top:facet===capMesh[0]});
          }
        }
        meshCache.set(c,cached);
      }
      if(skinMeshRevision!==paletteRevision){skinMeshCache=new WeakMap();skinMeshRevision=paletteRevision;}
      if(!window.CubeSkins)return cached;
      const old=skinMeshCache.get(c);if(old)return old;
      const result=paletteId==='diamond'?cached.filter(f=>!f.sticker):[...cached];
      if(paletteId==='diamond')for(const name of FACES){
        if(c.sticker[name]===INNER)continue;
        for(const facet of CubeSkins.gemFacets()){
          const transform=q=>localVector(orientPoint(q,FACE_N0[name]),c),localPts=facet.pts.map(transform);
          result.push({localPts,pts:localPts.map(q=>[q[0]+c.x,q[1]+c.y,q[2]+c.z]),n:transform(facet.normal),uv:facet.pts.map(q=>[q[0]/.84+.5,q[1]/.84+.5]),color:c.sticker[name],sticker:true,top:facet.top});
        }
      }
      skinMeshCache.set(c,result);return result;
    }

    function localVector(v, cubie, orientation=cubie.local) {
      const r=orientation.R,u=orientation.U,f=orientation.F;
      return [v[0]*r[0]+v[1]*u[0]+v[2]*f[0],v[0]*r[1]+v[1]*u[1]+v[2]*f[1],v[0]*r[2]+v[1]*u[2]+v[2]*f[2]];
    }

    function hexRGB(hex) {
      return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }
    const ERR_RGB = hexRGB(ERROR_HEX);

    function shadeRGB(hex, n, boost, tintK) {
      const nn = cameraVector(n);

      let lum = 0.60 + 0.40 * Math.max(0, nn[2] * 0.42 + nn[1] * 0.62 + 0.42);
      if (boost) lum += 0.28;
      let [r, g, b] = hexRGB(hex);
      if (tintK > 0) {
        r = r + (ERR_RGB[0] - r) * tintK;
        g = g + (ERR_RGB[1] - g) * tintK;
        b = b + (ERR_RGB[2] - b) * tintK;
      }
      const c = v => Math.max(0, Math.min(255, Math.round(v * lum)));
      return [c(r)/255,c(g)/255,c(b)/255];
    }

    function guideColor() {
      const light=typeof document!=="undefined" && document.documentElement.dataset.theme==="light";
      return guideMove?.endsWith("2")?(light?"#8047ed":GUIDE_DOUBLE):(light?"#00af61":GUIDE_SINGLE);
    }
    function guideMeshes(now) {
      if(!guideMove || intro)return [];
      const sp=MOVE_SPEC[guideMove[0]],sign=Math.sign(moveAngle(guideMove))||1;
      const base=sp.axis==="x"?[0,1,0]:[1,0,0],center=[0,0,0];
      const axis=sp.axis==="x"?0:sp.axis==="y"?1:2;center[axis]=sp.layer*1.16;
      const point=(radius,angle)=>rot(base.map(v=>v*radius),sp.axis,angle).map((v,k)=>v+center[k]);
      const phase=reducedMotion()?0:(now/1000)*.95*sign;
      const radius=2.65,half=.115,span=Math.PI-.64,color=guideColor(),meshes=[];
      const append=pts=>meshes.push({pts,n:[0,0,0],color,arrow:true});
      for(let arm=0;arm<2;arm++){
        const start=phase+arm*Math.PI,end=start+sign*span,shaftEnd=end-sign*.23;
        for(let i=0;i<32;i++){
          const a=start+(shaftEnd-start)*i/32-(i?sign*.008:0),b=start+(shaftEnd-start)*(i+1)/32+(i<31?sign*.008:0);
          append([point(radius-half,a),point(radius+half,a),point(radius+half,b),point(radius-half,b)]);
        }
        append([point(radius,end),point(radius+.32,shaftEnd),point(radius-.32,shaftEnd)]);
      }
      return meshes;
    }

    function cross(a, b) {
      return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }
    function norm(v) {
      const L = Math.hypot(v[0], v[1], v[2]) || 1;
      return [v[0] / L, v[1] / L, v[2] / L];
    }
    const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

    function draw() {
      const ctx = context2d;
      if (!gpu && !ctx) return;
      const w = canvas.width, h = canvas.height;
      if(ctx){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);}
      const now = performance.now();

      const columns = [[1,0,0],[0,1,0],[0,0,1]].map(p =>
        rot(rot(inGrip(poseVector(p)), "y", view.yaw), "x", view.pitch));
      cameraRows = [0,1,2].map(i => columns.map(column => column[i]));

      let animAng = 0, animSp = null;
      if (intro?.demoAnim) {
        animSp=MOVE_SPEC[intro.demoAnim.move[0]];
        const p=intro.demoAnim.progress,ease=p*p*(3-2*p);
        animAng=moveAngle(intro.demoAnim.move)*ease;
      } else if (!intro && anim) {
        animSp = MOVE_SPEC[anim.move[0]];
        const p = anim.dur ? Math.max(0, Math.min(1, (now - anim.t0) / anim.dur)) : 1;
        animAng = anim.target * (1 - Math.pow(1 - p, 3));
      }

      let tintK = 0;
      if (errT0) {
        if (now - errT0 > 700) errT0 = 0;
        else if (Math.floor((now - errT0) / 90) % 2 === 0) tintK = 0.62;
      }

      let guideSp = null;
      if (guideMove && !intro) guideSp = MOVE_SPEC[guideMove[0]];

      const list = [];
      const camera = cameraRows[2].map(v=>v*7.2);
      const fullDepth=false;
      const pieces = intro ? intro.cubies : cubies;
      const skin=window.CubeSkins?.definitions[paletteId];

      for (const c of pieces) {

        let pos = [c.x, c.y, c.z];
        const turning = animSp && c[animSp.axis] === animSp.layer;
        if (turning) pos = rot(pos, animSp.axis, animAng);
        const entry = introPiece(c, now);
        if (entry) pos=pos.map((v,k)=>v+entry.offset[k]);

        const inGuideLayer = guideSp && c[guideSp.axis] === guideSp.layer;

        for (const facet of meshForCubie(c)) {
          let n=facet.n,first=facet.pts[0],pp;
          let orient=null;
          if(entry){
            orient=q=>{const v=turning?rot(q,animSp.axis,animAng):q;return rot(rot(v,"y",entry.spin),"x",entry.spin*.45);};
            n=orient(n);first=add3(orient(facet.localPts[0]),pos);
          }else if(turning){
            n=rot(n,animSp.axis,animAng);first=rot(first,animSp.axis,animAng);
          }
          if(!fullDepth&&n[0]*(camera[0]-first[0])+n[1]*(camera[1]-first[1])+n[2]*(camera[2]-first[2])<=0)continue;
          if(entry)pp=facet.localPts.map(q=>add3(orient(q),pos));
          else if(turning)pp=facet.pts.map(q=>rot(q,animSp.axis,animAng));
          else pp=facet.pts;
          const target=facet.sticker&&inGuideLayer;
          list.push({pts:pp,n,vertexNormals:entry?facet.vertexNormals?.map(orient):turning?facet.vertexNormals?.map(v=>rot(v,animSp.axis,animAng)):facet.vertexNormals,kind:facet.kind,seed:facet.seed,color:facet.color,boost:target,sticker:facet.sticker,target,outline:target&&facet.top,uv:facet.uv,top:facet.top,decal:facet.decal,hair:facet.hair});
        }
      }

      list.push(...guideMeshes(now));
      for(const f of list){
        const tint=f.target?(guideError ? .88 : tintK):0;
        const skin=window.CubeSkins?.definitions[paletteId];
        const colour=f.decal?f.color:f.sticker?displayColor(f.color):skin?.plastic||PLASTIC;
        if(gpu&&skin?.material&&f.sticker&&(!f.decal||f.kind)){f.translucent=!!skin.translucent&&!f.kind;f.rgb=hexRGB(colour).map(v=>v/255);f.material=f.kind||(f.hair?3:f.top?1:2);f.tint=tint;}
        else f.rgb=f.arrow?hexRGB(f.color).map(v=>v/255):shadeRGB(colour,f.n,f.boost,tint);
        if(f.outline)f.rim=hexRGB(guideError?ERROR_HEX:guideColor()).map(v=>v/255);
      }
      if(gpu){gpu.draw(list,cameraRows,guideMove?2.72:3.35,w,h);return;}

      for (const f of list) {
        let z = 0;
        for (const q of f.pts) {
          z += cameraRows[2][0]*q[0]+cameraRows[2][1]*q[1]+cameraRows[2][2]*q[2];
        }
        f.z = z / f.pts.length;
      }
      list.sort((a, b) => a.z - b.z);

      for (const f of list) {
        const p = f.arrow?f.pts.map(q=>project(q,w,h)):projQuad(f.pts, w, h);
        if (!p) continue;

        if (f.sticker || f.arrow) {
          const cx=p.reduce((sum,q)=>sum+q[0],0)/p.length;
          const cy=p.reduce((sum,q)=>sum+q[1],0)/p.length;
          for(const q of p){
            const dx=q[0]-cx,dy=q[1]-cy,scale=(f.arrow?.8:.35)*dpr/(Math.hypot(dx,dy)||1);
            q[0]+=dx*scale;q[1]+=dy*scale;
          }
        }
        if(f.arrow)fillPoly(ctx,p,f.color);
        else {
          const tint=f.target?(guideError?0.88:tintK):0;
          fillPoly(ctx,p,`rgb(${f.rgb.map(v=>Math.round(v*255)).join(",")})`);
          if(f.outline){
            ctx.save();ctx.lineJoin="round";ctx.lineWidth=2.5*dpr;
            ctx.strokeStyle=guideError?ERROR_HEX:guideColor();
            ctx.stroke();ctx.restore();
          }
        }
      }

    }

    function advance(now) {
      advancePose(now);

      if (queue.length > 1 || (anim && queue.length && now-anim.at >= MAX_VISUAL_LAG)) {
        if (anim) { applyMove(anim.move); anim = null; }
        while (queue.length > 1) applyMove(queue.shift().move);
      }
      let endedAt = null;
      while (anim || queue.length) {
        if (!anim) {
          const entry = queue.shift();
          const t0 = Math.max(entry.at, endedAt ?? entry.at);
          const end = Math.min(t0+TURN_MS, entry.at+MAX_VISUAL_LAG);
          anim = {move:entry.move, at:entry.at, t0, dur:Math.max(0,end-t0), target:moveAngle(entry.move)};
        }
        if (now < anim.t0+anim.dur) break;
        endedAt = anim.t0+anim.dur;
        applyMove(anim.move);
        anim = null;
      }
    }

    canvas.addEventListener?.("webglcontextrestored",()=>{dirty=true;});
    let raf = 0, dirty = true, lastCubies = null, lastView = "";
    function loop() {
      const now=performance.now();
      advance(now);advanceIntro(now);alignSolvedDecoration();
      const viewKey=[canvas.width,canvas.height,view.yaw,view.pitch,guideMove,gripKey,paletteRevision,...poseCurrent].join("|");
      const hidden=document.hidden||document.body?.classList?.contains("celebration-active")||(typeof canvas.getClientRects==="function"&&!canvas.getClientRects().length);
      if(hidden)dirty=true;
      if (!hidden && (dirty || intro || anim || queue.length || guideMove || errT0 || lastCubies!==cubies || lastView!==viewKey)) {
        draw();
        dirty=false;lastCubies=cubies;lastView=viewKey;
      }
      raf = requestAnimationFrame(loop);
    }

    let decorationPending=false;
    function alignSolvedDecoration(){
      if(!decorationPending||anim||queue.length)return;
      decorationPending=false;
      for(const c of cubies)for(const name of FACES){
        if(c.sticker[name]===INNER)continue;
        const target=FACE_N0[COLOR_FACE[c.sticker[name]]];
        if(!target||c.local[name].some((v,i)=>v!==target[i]))return;
      }
      for(const c of cubies){
        if(Object.values(c.sticker).filter(v=>v!==INNER).length!==1)continue;
        c.decoration=Object.fromEntries(FACES.map(f=>[f,[...FACE_N0[f]]]));skinMeshCache.delete(c);
      }
      dirty=true;
    }
    function applyMove(move) { dirty=true;decorationPending=true;rotateCubies(cubies,move); }
    function rotateCubies(pieces, move) {
      const face = move[0];
      const sp = MOVE_SPEC[face];
      if (!sp) return;
      const ang = moveAngle(move);
      for (const c of pieces) {
        if (c[sp.axis] !== sp.layer) continue;
        meshCache.delete(c);skinMeshCache.delete(c);
        const p = rot([c.x, c.y, c.z], sp.axis, ang);
        c.x = Math.round(p[0]); c.y = Math.round(p[1]); c.z = Math.round(p[2]);
        for (const k of FACES) {
          c.local[k] = rot(c.local[k], sp.axis, ang).map(Math.round);
          if(c.decoration)c.decoration[k]=rot(c.decoration[k],sp.axis,ang).map(Math.round);
        }
      }
    }

    return {
      reset() { cubies = newCubies(); anim = null; queue = []; guideMove = null; errT0 = 0; },

      turn(move) {
        if (typeof move === "string" && MOVE_SPEC[move[0]] && ["", "\'", "2"].includes(move.slice(1))) {
          cancelIntro(); queue.push({move,at:performance.now()});
        }
      },

      isBusy() { return !!(anim || queue.length); },

      guide(move, error=false) {
        guideMove = move && MOVE_SPEC[move[0]] ? move : null;
        guideError=!!guideMove && !!error;dirty=true;
        if(!guideError)errT0=0;
      },

      faceToward(face) {
        const n = FACE_N0[face];
        if (!n) return 0;
        const v = rot(rot(inGrip(n), "y", view.yaw), "x", view.pitch);
        return v[2];
      },
      getView() { return { yaw: view.yaw, pitch: view.pitch }; },

      flashError() { errT0 = performance.now(); },

      setSolved() {
        cubies = newCubies();
        anim = null; queue = []; guideMove = null;
      },

      setFromFacelets(facelets) {
        cubies = newCubies();
        anim = null; queue = [];
        const want = {};
        for (const face of FACES) {
          const cells = facelets[face];
          if (!cells || cells.length !== 9) return;
          for (let i = 0; i < 9; i++) {
            const a = Math.floor(i / 3), b = i % 3;
            const p = facePos(face, a, b);

            (want[p.join(",")] = want[p.join(",")] || {})[face] = toHex(cells[i]);
          }
        }

        for (const c of cubies) {
          const w = want[[c.x, c.y, c.z].join(",")];
          if (!w) continue;
          for (const k of FACES) {
            if (c.sticker[k] !== INNER) c.sticker[k] = w[k] !== undefined ? w[k] : INNER;
          }
        }

        const ORIENTS = allOrientations();
        for (const c of cubies) {
          const w = want[[c.x, c.y, c.z].join(",")];
          if (!w) continue;
          for (const ori of ORIENTS) {
            if (fits(c.sticker, ori, w)) {

              c.local = Object.fromEntries(FACES.map(face => [face, [...ori[face]]]));
              break;
            }
          }
        }
      },
      setGrip(top="U",front="F") {
        if(!FACE_N0[top]||!FACE_N0[front]||dot(FACE_N0[top],FACE_N0[front])!==0)return;
        const key=top+"/"+front;if(key===gripKey)return;
        const up=FACE_N0[top],f=FACE_N0[front],right=[up[1]*f[2]-up[2]*f[1],up[2]*f[0]-up[0]*f[2],up[0]*f[1]-up[1]*f[0]];
        basis=[right,up,f];gripKey=key;viewAnimation++;view={...VIEW_DEFAULT};dirty=true;
      },
      getGrip(){return gripKey;},
      setOrientation, calibrateOrientation,
      setView(yaw, pitch) { viewAnimation++; view.yaw = yaw; view.pitch = pitch; },
      defaultView() { cancelIntro(); viewAnimation++; view = { ...VIEW_DEFAULT }; },

      resetView() { viewAnimation++; view = { ...VIEW_RESET }; },

      debugQuads() {
        const out = {};
        for (const f of FACES) out[f] = orientQuad(FACE_N0[f]);
        return out;
      },

      debugFacingOrder() {
        return FACES.map(f => {
          const n = rot(rot(inGrip(FACE_N0[f]), "y", view.yaw), "x", view.pitch);
          return [f, n[2]];
        }).sort((a, b) => b[1] - a[1]).map(([f]) => f);
      },

      debugState() {
        return {
          queue: queue.map(entry=>entry.move), anim: anim ? anim.move : null,
          visualLagMs: Math.max(0,performance.now()-(anim?.at ?? queue[0]?.at ?? performance.now())),
          guide: guideMove, erroring: guideError || !!errT0, renderer:gpu?"webgl-depth":"canvas2d", pose:[...poseCurrent],skin:paletteId,decorationPending,alignedCenters:cubies.filter(c=>c.decoration).length,materialMemory:gpu?.info(),
        };
      },
      orbit(dyaw, dpitch) {
        cancelIntro();viewAnimation++;
        view.yaw += dyaw;
        view.pitch = Math.max(-1.35, Math.min(1.35, view.pitch + dpitch));
      },
      resize() { fit(); },
      start() { fit(); if (!raf) loop(); },
      stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
      dispose() { if(raf)cancelAnimationFrame(raf);raf=0;gpu?.dispose(); },

      debugFacelets() {

        const out = { U: [], D: [], F: [], B: [], R: [], L: [] };
        for (const face of FACES) {
          const n = FACE_N0[face];
          for (let a = 0; a < 3; a++)
            for (let b = 0; b < 3; b++) {
              const p = facePos(face, a, b);
              const c = cubies.find(q => q.x === p[0] && q.y === p[1] && q.z === p[2]);

              let hex = INNER;
              if (c) {
                for (const k of FACES) {
                  const d = c.local[k];
                  if (d[0] === n[0] && d[1] === n[1] && d[2] === n[2]) { hex = c.sticker[k]; break; }
                }
              }
              out[face].push(hex);
            }
        }
        return out;
      },

      _advance(now) { advance(now);advanceIntro(now);alignSolvedDecoration(); },
      _draw() { draw(); },

      applyNow(move) { applyMove(move); },
      rotateTo(yaw, pitch, ms) {
        const motion = ++viewAnimation;
        const y0 = view.yaw, p0 = view.pitch, t0 = performance.now();
        (function step() {
          if (motion !== viewAnimation) return;
          const p = Math.min(1, (performance.now() - t0) / ms);
          const e = 1 - Math.pow(1 - p, 3);
          view.yaw = y0 + (yaw - y0) * e;
          view.pitch = p0 + (pitch - p0) * e;
          if (p < 1) requestAnimationFrame(step);
        })();
      },
    };
  }

  window.Cube3D = { create, FACE_HEX, NUM_TO_FACE, toHex, FACE_CN, PALETTES, setPalette, getPalette:()=>paletteId, displayColor };
})();
