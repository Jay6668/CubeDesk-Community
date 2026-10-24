/* Optional real-WebGL integration check. Start the local server before running. */
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
(async()=>{
 const origin=process.env.CE_URL||'http://127.0.0.1:43729',out=path.resolve(process.env.CE_QA_OUTPUT||'artifacts/browser');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:process.env.CE_BROWSER_CHANNEL||'msedge',headless:true,args:['--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(origin);await page.waitForFunction(()=>window.CommunityUI?.getState());
  const action=(action,values={})=>page.evaluate(async body=>{const r=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const b=await r.json();if(!b.ok)throw Error(b.error);return b},{action,...values});
  await action('cancel');await action('simulation');await action('simulation_reset');
  for(const skin of ['classic','diamond']){
   await action('skin',{value:skin});await action('simulation_reset');
   for(const move of ['R','U',"F'",'L2','B','D',"R'",'U2'])await action('simulation_move',{move});
   const expected=await page.evaluate(()=>fetch('/api/state').then(r=>r.json()));
   await page.waitForFunction(seq=>CommunityUI.getState().sequence===seq&&!CommunityUI.cube.isBusy(),expected.sequence);
   const equal=await page.evaluate(()=>{const c=CommunityUI.cube.debugFacelets(),f=CommunityUI.getState().practice.facelets;return Object.keys(f).every(k=>JSON.stringify(c[k])===JSON.stringify(f[k].map(Cube3D.toHex)))});
   if(!equal)throw Error(skin+' renderer/state mismatch');
   await page.screenshot({path:path.join(out,'state-'+skin+'.png')});
  }
  await action('simulation_reset');await page.waitForTimeout(200);
  await page.click('#newScramble');await page.click('#demoScramble');await page.waitForFunction(()=>CommunityUI.getState().practice.phase==='ready',null,{timeout:60000});
  const scramble=await page.evaluate(()=>CommunityUI.getState().practice.scramble);
  for(const m of [...scramble].reverse()){await action('simulation_move',{move:m.endsWith('2')?m:m.endsWith("'")?m.slice(0,-1):m+"'"});await page.waitForTimeout(80)}
  await page.waitForFunction(()=>CommunityUI.getState().practice.phase==='finished');
  const result=await page.evaluate(()=>CommunityUI.getState().practice.result);if(result.source!=='simulation')throw Error('Simulation source lost');
  await page.reload();await page.waitForFunction(()=>CommunityUI.getState()?.practice.phase==='finished');
  for(const [name,width,height] of [['desktop',1280,800],['portrait',393,873],['landscape',873,393]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(300);await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error(name+' horizontal overflow');
   await page.click('#settingsOpen');const box=await page.locator('#settingsDialog').boundingBox();if(box.x<0||box.width>width+1)throw Error(name+' dialog overflow');await page.click('[data-close="settingsDialog"]');
  }
  if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({errors,renderers:['classic','diamond'],flow:'completed',source:result.source,viewports:3,reload:true},null,2));console.log('Browser flow and renderer/state agreement passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
