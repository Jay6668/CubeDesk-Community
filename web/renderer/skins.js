

(()=>{'use strict';
 const classic={U:'#f2f4f7',D:'#f7d117',F:'#22c568',B:'#1358c4',R:'#ed3541',L:'#f07a17'};
 const definitions=Object.freeze({classic:{name:'经典六色',material:0,colours:classic,plastic:'#191d24'},diamond:{name:'棱光星钻',material:1,colours:{...classic},plastic:'#647282'}});
 const palettes=Object.freeze(Object.fromEntries(Object.entries(definitions).map(([id,d])=>[id,d.colours])));
 const isKnown=id=>Object.prototype.hasOwnProperty.call(definitions,id);
 const normalize=id=>isKnown(id)?id:'classic';let gem=null;
function gemFacets(){
  if(gem)return gem;
  const ring=(h,c,z)=>[[h,c,z],[c,h,z],[-c,h,z],[-h,c,z],[-h,-c,z],[-c,-h,z],[c,-h,z],[h,-c,z]];
  const rings=[ring(.315,.194,.492),ring(.457,.305,.448),ring(.444,.29,.426)];
  gem=[{pts:rings[0],normal:[0,0,1],top:true}];
  for(let r=0;r<rings.length-1;r++)for(let i=0;i<8;i++){
   const j=(i+1)%8,pts=[rings[r][i],rings[r+1][i],rings[r+1][j],rings[r][j]];
   const a=pts[1].map((v,k)=>v-pts[0][k]),b=pts[2].map((v,k)=>v-pts[0][k]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...n)||1;
   gem.push({pts,normal:n.map(v=>v/length)});
  }
  return gem;
 }
 const vertex=`attribute vec4 a_position;attribute vec3 a_color;attribute vec2 a_uv;attribute vec3 a_normal;attribute vec3 a_surface;
 uniform mat3 u_camera;uniform vec2 u_scale;varying lowp vec3 v_color;varying mediump vec2 v_uv;varying mediump vec3 v_normal;varying mediump vec3 v_surface;varying mediump vec3 v_position;
 void main(){vec3 c=u_camera*a_position.xyz;float d=7.2-c.z-a_position.w;gl_Position=vec4(c.xy*u_scale,(21.0*d-40.0)/19.0,d);v_color=a_color;v_uv=a_uv;v_normal=u_camera*a_normal;v_surface=a_surface;v_position=c;}`;
 const fragment=`precision mediump float;varying lowp vec3 v_color;varying mediump vec2 v_uv;varying mediump vec3 v_normal;varying mediump vec3 v_surface;varying mediump vec3 v_position;uniform float u_skin;
 highp float hash(highp vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}

 void main(){
  if(v_surface.x<.5){gl_FragColor=vec4(v_color,1.0);return;}
  vec2 q=v_uv-.5;vec3 n=normalize(v_normal),base=v_color;float bevel=step(1.5,v_surface.x)*(1.0-step(2.5,v_surface.x));
  vec3 light=normalize(vec3(-.45,.72,1.0)),halfway=normalize(light+vec3(0.,0.,1.));
  float lambert=max(dot(n,light),0.),facing=max(n.z,0.),spec=0.;vec3 shine=vec3(1.0);float detail=0.;

  if(u_skin<1.5){
   // Genuine crown normals and camera-dependent studio reflections.
   vec3 view=normalize(vec3(-v_position.xy,7.2-v_position.z));
   vec3 reflected=reflect(-view,n);
   float fresnel=pow(1.-max(dot(n,view),0.),4.);
   float strip=exp(-pow((reflected.x+.34*reflected.y-.16)*11.,2.))*smoothstep(-.6,.2,reflected.y);
   float strip2=exp(-pow((reflected.y-.30)*9.,2.))*smoothstep(-.5,.4,reflected.x);
   float key=pow(max(dot(n,normalize(light+view)),0.),72.);
   float fill=pow(max(dot(n,normalize(normalize(vec3(.85,-.25,1.))+view)),0.),100.);
   float edge=pow(clamp(max(abs(q.x),abs(q.y))*2.12,0.,1.),4.);
   float caustic=exp(-pow((q.x-q.y*.63-.13)*15.,2.))*.16;
   vec3 glass=base*(.64+lambert*.29+caustic)+base*vec3(.13,.19,.23)*edge;
   float reflection=clamp(strip*.25+strip2*.25+fresnel*.38+bevel*.08,0.,.80);
   vec3 colour=mix(glass,vec3(.93,.97,1.),reflection)+vec3(1.,.98,.94)*key*.66+vec3(.76,.90,1.)*fill*.38;
   vec2 spot=v_uv-vec2(.69,.72);
   float glint=exp(-abs(spot.x)*180.-abs(spot.y)*14.)+exp(-abs(spot.y)*180.-abs(spot.x)*14.);
   float sparkle=pow(max(sin(dot(v_position,vec3(2.9,4.1,1.7))),0.),6.)*(.2+.8*pow(facing,4.));
   colour+=vec3(1.,.97,.90)*glint*max(smoothstep(.10,.34,key),sparkle)*1.25;
   colour+=vec3(.08,.025,.11)*edge*strip2;
   colour=mix(colour,vec3(.90,.19,.24),clamp(v_surface.y,0.,1.));
   gl_FragColor=vec4(clamp(colour,0.,1.),1.);return;

  }
 }`;
function createRenderer(gl){

  const compile=(type,source)=>{if(typeof WebGL2RenderingContext!=="undefined"&&gl instanceof WebGL2RenderingContext){source=type===gl.VERTEX_SHADER?'#version 300 es\n'+source.replace(/\battribute\b/g,'in').replace(/\bvarying\b/g,'out'):'#version 300 es\nprecision mediump float;out vec4 skinOutput;\n'+source.replace(/\bvarying\b/g,'in').replace(/gl_FragColor/g,'skinOutput').replace(/texture2D\(/g,'texture(');}const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw Error(message);}return shader;};
  let program,buffer;const shaders=[];
  try{shaders.push(compile(gl.VERTEX_SHADER,vertex));shaders.push(compile(gl.FRAGMENT_SHADER,fragment));program=gl.createProgram();for(const shader of shaders)gl.attachShader(program,shader);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));buffer=gl.createBuffer();}
  catch(e){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);throw e;}
  finally{for(const shader of shaders)gl.deleteShader(shader);}
  const attributes=['a_position','a_color','a_uv','a_normal','a_surface'].map(name=>gl.getAttribLocation(program,name));
  const cameraLocation=gl.getUniformLocation(program,'u_camera'),scaleLocation=gl.getUniformLocation(program,'u_scale'),skinLocation=gl.getUniformLocation(program,'u_skin');
  const materialUniforms=null;const opaque=[],transparent=[],matrix=new Float32Array(9);let vertices=new Float32Array(65536),gpuBytes=0;
  function draw(faces,camera,focal,w,h,id){
   gl.disable(gl.CULL_FACE);
   let count=0;const normal=[0,0,1],uv=[0,0];
   function vertexPoint(p,colour,texture,faceNormal,surface,tint,boost,bias=0){
    if(count+15>vertices.length){const next=new Float32Array(vertices.length*2);next.set(vertices);vertices=next;}
    vertices[count++]=p[0];vertices[count++]=p[1];vertices[count++]=p[2];vertices[count++]=bias;
    vertices[count++]=colour[0];vertices[count++]=colour[1];vertices[count++]=colour[2];
    vertices[count++]=texture[0];vertices[count++]=texture[1];vertices[count++]=faceNormal[0];vertices[count++]=faceNormal[1];vertices[count++]=faceNormal[2];
    vertices[count++]=surface;vertices[count++]=tint;vertices[count++]=boost;
   }
   opaque.length=transparent.length=0;
   for(const face of faces){
    if(face.translucent){face.depth=face.pts.reduce((sum,p)=>sum+camera[2][0]*p[0]+camera[2][1]*p[1]+camera[2][2]*p[2],0)/face.pts.length;transparent.push(face);}else opaque.push(face);
   }
   transparent.sort((a,b)=>a.depth-b.depth);
   let opaqueCount=0;
   for(let pass=0;pass<2;pass++){
   for(const face of pass?transparent:opaque){

    const pts=face.pts,col=face.rgb,n=face.n||normal,coordinates=face.uv,surface=face.material||0,tint=face.tint||0,boost=face.boost?1:0,vn=face.vertexNormals;
    for(let i=1;i+1<pts.length;i++){vertexPoint(pts[0],col,coordinates?.[0]||uv,vn?.[0]||n,surface,tint,boost);vertexPoint(pts[i],col,coordinates?.[i]||uv,vn?.[i]||n,surface,tint,boost);vertexPoint(pts[i+1],col,coordinates?.[i+1]||uv,vn?.[i+1]||n,surface,tint,boost);}
    if(face.rim){const c=[0,0,0];for(const p of pts){c[0]+=p[0];c[1]+=p[1];c[2]+=p[2];}for(let k=0;k<3;k++)c[k]/=pts.length;const inner=pts.map(p=>p.map((v,k)=>v*.94+c[k]*.06));for(let i=0;i<pts.length;i++){const j=(i+1)%pts.length;for(const p of [pts[i],pts[j],inner[j],pts[i],inner[j],inner[i]])vertexPoint(p,face.rim,uv,n,0,0,0,.001);}}
   }
   if(!pass)opaqueCount=count/15;
   }
   gl.depthMask(true);gl.viewport(0,0,w,h);gl.clearColor(0,0,0,0);gl.clearDepth(1);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   for(let row=0;row<3;row++)for(let col=0;col<3;col++)matrix[col*3+row]=camera[row][col];
   gl.uniformMatrix3fv(cameraLocation,false,matrix);gl.uniform2f(scaleLocation,2*focal*Math.min(w,h)*.42/w,2*focal*Math.min(w,h)*.42/h);gl.uniform1f(skinLocation,definitions[id].material);
   gl.bufferData(gl.ARRAY_BUFFER,vertices.subarray(0,count),gl.DYNAMIC_DRAW);gpuBytes=count*4;
   const size=[4,3,2,3,3],offset=[0,16,28,36,48];for(let i=0;i<attributes.length;i++){gl.enableVertexAttribArray(attributes[i]);gl.vertexAttribPointer(attributes[i],size[i],gl.FLOAT,false,60,offset[i]);}
   materialUniforms?.begin(w,h,id);gl.drawArrays(gl.TRIANGLES,0,opaqueCount);
   if(transparent.length&&definitions[id].refract){materialUniforms?.capture(w,h);gl.drawArrays(gl.TRIANGLES,0,opaqueCount);}
   if(transparent.length){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.drawArrays(gl.TRIANGLES,opaqueCount,count/15-opaqueCount);gl.depthMask(true);gl.disable(gl.BLEND);}
  }
  return {draw, info:()=>({cpuBufferBytes:vertices.byteLength,gpuBufferBytes:gpuBytes,textures:0}),dispose(){for(const location of attributes)gl.disableVertexAttribArray(location);gl.deleteBuffer(buffer);gl.deleteProgram(program);}};
 }
 window.CubeSkins={definitions,palettes,isKnown,normalize,gemFacets,createRenderer};
})();
