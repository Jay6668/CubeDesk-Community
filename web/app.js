/* Community UI consumes accepted move events. Hardware, timing and records live in Python. */
(()=>{'use strict';
 const $=id=>document.getElementById(id),cube=Cube3D.create($('cube'));
 cube.start();
 let state=null,cursor=0,epoch=-1,rendered=0,stopped=false,noticeTimer=0,demoBusy=false,historyKey='';
 const phaseNames={idle:'准备练习',scrambling:'按提示打乱',ready:'打乱完成 · 首次转动开始计时',solving:'正在复原',finished:'复原完成'};
 const format=ms=>{const sec=Math.max(0,Number(ms)||0)/1000;return sec>=60?Math.floor(sec/60)+':'+(sec%60).toFixed(2).padStart(5,'0'):sec.toFixed(2)};
 function notice(message){$('notice').textContent=message;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,4200)}
 function open(id){const el=$(id);if(!el.open)el.showModal()}
 async function request(action,values={}){
  const response=await fetch('/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...values})});
  const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'操作未完成');if(result.practice)paint(result);return result;
 }
 async function run(button,action,values={}){
  button.disabled=true;try{return await request(action,values)}catch(error){notice(error.message)}finally{button.disabled=false}
 }
 function records(rows){
  const signature=rows.map(r=>r.id).join(',');if(signature===historyKey)return;historyKey=signature;
  const list=$('records');list.replaceChildren();
  if(!rows.length){const li=document.createElement('li');li.className='empty';li.textContent='还没有记录。完成第一把后，成绩会出现在这里。';list.append(li);return}
  for(const r of rows){const li=document.createElement('li'),button=document.createElement('button');button.className='record-link';
   const value=document.createElement('span');value.className='record-time';value.textContent=format(r.time_ms);
   const source=document.createElement('span');source.className='record-source';source.textContent=r.source==='simulation'?'演示':'智能魔方';
   const detail=document.createElement('small');detail.textContent=r.turns_qtm+' 步 · '+(r.tps_qtm??'—')+' TPS';
   button.append(value,source,detail);button.onclick=async()=>{try{const response=await fetch('/api/records/'+encodeURIComponent(r.id));if(!response.ok)throw Error('记录读取失败');$('recordJson').textContent=JSON.stringify(await response.json(),null,2);open('recordDialog')}catch(error){notice(error.message)}};li.append(button);list.append(li);
  }
 }
 function paint(s){
  if(!s.practice||s.snapshot_id<=rendered)return;rendered=s.snapshot_id;state=s;
  const p=s.practice,d=s.device,active=['scrambling','ready','solving'].includes(p.phase),demo=p.source==='simulation';
  if(epoch!==s.cube_epoch||cursor>s.sequence||s.sequence-cursor>s.events.length){cube.setFromFacelets(p.facelets);cursor=s.sequence;epoch=s.cube_epoch}
  else{for(const event of s.events)if(event.sequence>cursor){cube.turn(event.move);cursor=event.sequence}}
  Cube3D.setPalette(s.skin);$('skin').value=s.skin;
  $('connectionDot').dataset.connected=String(d.connected&&!demo);
  $('connectionLabel').textContent=d.connecting?'正在连接…':d.connected?d.name:demo?'演示模式':'连接魔方';
  $('modeLabel').textContent=demo?'演示 · 非实体成绩':d.connected?'MoYu32 · 已连接':'等待连接';$('modeLabel').dataset.mode=demo?'simulation':'device';
  $('practiceHeading').textContent=p.phase==='finished'?'完成，看看这一把。':'从这一把开始。';
  $('phaseLabel').textContent=p.error||(!p.known?'先连接智能魔方，也可以进入明确标注的演示模式。':phaseNames[p.phase]);
  if(d.connected&&d.error)$('phaseLabel').textContent=d.error;
  $('clock').replaceChildren(document.createTextNode(format(p.elapsed_ms)));const unit=document.createElement('span');unit.textContent='秒';$('clock').append(unit);
  $('newScramble').disabled=active||!p.known||(!demo&&!d.connected)||demoBusy;$('newScramble').textContent=p.phase==='finished'?'再练一把':'生成打乱';$('cancelRun').hidden=!active;
  $('metrics').hidden=p.phase!=='finished';const result=p.result;
  $('turns').textContent=result?.turns_qtm??'—';$('tps').textContent=result?.tps_qtm??'—';
  $('flowHint').textContent=demo?(p.phase==='finished'?'演示成绩已标记保存，不是真实魔方成绩。':'当前使用模拟转动；先执行打乱，再用面转按钮复原。'):(p.phase==='finished'?(result?.timestamp_source==='host_batch'?'含批量通知：按主机收到事件的时间计时，详情可在记录中查看。':'已保存到本机。用时采用主机单调时钟，完整转动可以在记录中读取。'):'白色朝上、绿色朝前。按序打乱后，首转开始计时，首次复原立即结束。');
  const scramble=$('scramble');scramble.replaceChildren();
  if(!p.scramble.length){const el=document.createElement('span');el.className='placeholder';el.textContent='打乱会显示在这里。';scramble.append(el)}
  p.scramble.forEach((move,i)=>{const el=document.createElement('span');el.textContent=move;if(i<p.progress)el.className='completed';else if(i===p.progress&&p.phase==='scrambling')el.className='current';scramble.append(el)});
  $('scrambleProgress').textContent=p.scramble.length?Math.min(p.progress,p.scramble.length)+' / '+p.scramble.length:'等待生成';
  cube.guide(p.phase==='scrambling'?(p.recovery[0]||p.scramble[p.progress]):null);
  $('recovery').hidden=!p.recovery.length;$('recovery').textContent='拧错了也可以退回：'+p.recovery.join(' ');
  $('simulationPanel').hidden=!demo;$('demoScramble').disabled=demoBusy||p.phase!=='scrambling';
  for(const button of $('moveButtons').children)button.disabled=demoBusy;
  $('demoReset').disabled=demoBusy;
  records(s.records||[]);
 }
 async function poll(){if(stopped)return;try{const response=await fetch('/api/state');if(response.ok)paint(await response.json())}catch{}finally{if(!stopped)setTimeout(poll,document.hidden?1000:100)}}
 $('connectOpen').onclick=()=>open('connectDialog');$('settingsOpen').onclick=()=>open('settingsDialog');
 for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
 $('resetView').onclick=()=>cube.defaultView();
 $('scan').onclick=async()=>{
  if(window.AndroidPermissions){const status=AndroidPermissions.bluetoothState();if(status==='permission'){AndroidPermissions.request();notice('请先允许附近设备或蓝牙权限，再扫描');return}if(status==='off'){AndroidPermissions.enableBluetooth();notice('请开启蓝牙后再扫描');return}}
  $('scanNote').textContent='正在扫描，请保持魔方唤醒…';$('devices').replaceChildren();const r=await run($('scan'),'scan');
  if(!r){$('scanNote').textContent='扫描未完成，请检查蓝牙、权限及其他应用占用。';return}
  $('scanNote').textContent=r.devices.length?'请选择设备。连接后还会检查实际 GATT 服务。':'没有发现匹配设备。请开启蓝牙、唤醒魔方并关闭其他连接应用。';
  for(const device of r.devices){const li=document.createElement('li'),label=document.createElement('div'),title=document.createElement('span'),small=document.createElement('small'),button=document.createElement('button');title.textContent=device.name;small.textContent=device.rssi==null?'MoYu32 候选设备':'信号 '+device.rssi+' dBm';label.append(title,small);button.textContent='连接';button.onclick=async()=>{const ok=await run(button,'connect',{id:device.id,mac:$('manualMac').value.trim()});if(ok){$('manualMac').value='';$('connectDialog').close();notice('已连接；请按白上、绿前握持魔方')}};li.append(label,button);$('devices').append(li)}
 };
 $('disconnect').onclick=()=>run($('disconnect'),'disconnect');$('refresh').onclick=()=>run($('refresh'),'refresh');
 $('simulation').onclick=async()=>{const ok=await run($('simulation'),'simulation');if(ok)$('connectDialog').close()};
 $('newScramble').onclick=()=>run($('newScramble'),'new_scramble');$('cancelRun').onclick=()=>run($('cancelRun'),'cancel');
 $('skin').onchange=()=>request('skin',{value:$('skin').value}).catch(error=>{notice(error.message);$('skin').value=state?.skin||'classic'});
 for(const face of ['U','R','F','D','L','B'])for(const suffix of ['',"'"]){const button=document.createElement('button');button.textContent=face+suffix;button.onclick=()=>run(button,'simulation_move',{move:face+suffix});$('moveButtons').append(button)}
 $('demoReset').onclick=()=>run($('demoReset'),'simulation_reset');
 $('demoScramble').onclick=async()=>{if(!state||state.practice.recovery.length){notice('请先重置演示，再生成打乱');return}demoBusy=true;try{const moves=state.practice.scramble.slice(state.practice.progress);for(const move of moves){await request('simulation_move',{move});await new Promise(r=>setTimeout(r,85))}}catch(error){notice(error.message)}finally{demoBusy=false}};
 addEventListener('beforeunload',()=>{stopped=true;cube.dispose()});
 window.CommunityUI={cube,paint,getState:()=>state};poll();
})();
