const API_URL = 'https://script.google.com/macros/s/AKfycbwtRTG8R8gndQNv68lyVCE-5xyE4yIgBi5QJove9bGYhvHvMuP1Ek_-P3Eev9vH_zfZ/exec';
let config = null;
let rsvps = [];
const $=id=>document.getElementById(id);
const state={token:sessionStorage.getItem('weddingAdminToken')||''};

function showNotice(message,type=''){const el=$('globalNotice');el.textContent=message;el.className=`notice ${type}`.trim();el.classList.remove('hidden');clearTimeout(showNotice.t);showNotice.t=setTimeout(()=>el.classList.add('hidden'),5000)}
function loginNotice(message,type='error'){const el=$('loginNotice');el.textContent=message;el.className=`notice ${type}`.trim();el.classList.remove('hidden')}
function setByPath(obj,path,value){const parts=path.split('.');let cur=obj;for(let i=0;i<parts.length-1;i++){cur=cur[parts[i]] ??= {}; }cur[parts.at(-1)]=value}
function getByPath(obj,path){return path.split('.').reduce((a,k)=>a?.[k],obj)}

async function apiGet(action, extra=''){
  const url=`${API_URL}?action=${encodeURIComponent(action)}${extra?`&${extra}`:''}&t=${Date.now()}`;
  const res=await fetch(url,{cache:'no-store'}); const json=await res.json(); if(!json.ok) throw new Error(json.error||'Request failed'); return json;
}
async function apiPost(payload){
  const res=await fetch(API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)}); const json=await res.json(); if(!json.ok) throw new Error(json.error||'Request failed'); return json;
}

function openDashboard(){ $('loginView').classList.add('hidden'); $('dashboardView').classList.remove('hidden'); loadAll(); }
function openLogin(){ $('dashboardView').classList.add('hidden'); $('loginView').classList.remove('hidden'); }

$('loginForm').addEventListener('submit',async e=>{e.preventDefault();const password=$('adminPassword').value;try{const result=await apiPost({action:'login',password});state.token=result.token;sessionStorage.setItem('weddingAdminToken',state.token);$('adminPassword').value='';openDashboard();}catch(err){loginNotice(err.message)}});
$('logoutBtn').addEventListener('click',()=>{sessionStorage.removeItem('weddingAdminToken');state.token='';openLogin()});
$('refreshBtn').addEventListener('click',loadAll);

document.querySelectorAll('.side-nav button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.side-nav button').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.tab-panel').forEach(p=>p.classList.add('hidden'));$(`tab-${btn.dataset.tab}`).classList.remove('hidden');if(btn.dataset.tab==='rsvp')loadRSVP();}));

document.querySelectorAll('.save-btn').forEach(btn=>btn.addEventListener('click',saveSettings));
$('addTimeline').addEventListener('click',()=>{config.timeline.push({time:'',title:'New Event',description:''});renderEventEditors()});
$('addPreWedding').addEventListener('click',()=>{config.preWedding.push({title:'New Event',date:'TBA',time:'',place:'',description:''});renderEventEditors()});
$('rsvpSearch').addEventListener('input',renderRSVP);$('rsvpFilter').addEventListener('change',renderRSVP);
$('passwordForm').addEventListener('submit',changePassword);

document.addEventListener('input',e=>{const path=e.target.dataset.path;if(!path||!config)return;let val=e.target.value;if(e.target.type==='color'||e.target.tagName==='SELECT'||e.target.type==='date')val=e.target.value;setByPath(config,path,val);updatePreview();});

document.addEventListener('change',e=>{const path=e.target.dataset.path;if(!path||!config)return;setByPath(config,path,e.target.value);updatePreview();});

async function loadAll(){
  if(!state.token){openLogin();return}
  try{const result=await apiGet('config');config=result.config;hydrateFields();renderEventEditors();updatePreview();const list=await apiGet('list',`token=${encodeURIComponent(state.token)}`);rsvps=list.rsvps||[];renderStats();renderRSVP();showNotice('Latest settings loaded.','success');}
  catch(err){if(/session|token|auth/i.test(err.message)){sessionStorage.removeItem('weddingAdminToken');state.token='';openLogin();loginNotice(err.message)}else showNotice(err.message,'error')}
}

function hydrateFields(){document.querySelectorAll('[data-path]').forEach(el=>{const v=getByPath(config,el.dataset.path); if(v!==undefined && v!==null) el.value=v;});}
function renderStats(){const total=rsvps.length;const confirmed=rsvps.filter(r=>r.status==='Confirmed').length;const declined=rsvps.filter(r=>r.status==='Declined').length;const attendees=rsvps.reduce((sum,r)=>sum+(Number(r.attendees)||0),0);$('statTotal').textContent=total;$('statConfirmed').textContent=confirmed;$('statDeclined').textContent=declined;$('statAttendees').textContent=attendees;}

function updatePreview(){if(!config)return;$('dashGroom').textContent=config.groomName||'Groom';$('dashBride').textContent=config.brideName||'Bride';$('dashDate').textContent=config.dateLabel||'';const src=config.heroVideoUrl||'assets/wedding-video.mp4';const vid=$('dashboardPreviewVideo');const media=$('heroMediaPreview'); if(vid.src!==new URL(src,location.href).href){vid.src=src;vid.load();vid.play().catch(()=>{})} if(media.src!==new URL(src,location.href).href){media.src=src;media.load()} $('adminImagePreview').src=config.locationImageUrl||config.openingPosterUrl||'assets/opening-poster.jpg';}

function renderEventEditors(){
  const tl=$('timelineEditors'), pw=$('preWeddingEditors'); tl.innerHTML=''; pw.innerHTML='';
  (config.timeline||[]).forEach((item,i)=>tl.appendChild(makeTimelineEditor(item,i)));
  (config.preWedding||[]).forEach((item,i)=>pw.appendChild(makePreEditor(item,i)));
}
function makeTimelineEditor(item,i){
  const el=document.createElement('div');el.className='event-editor';el.innerHTML=`<div class="row"><input class="tl-time" value="${escAttr(item.time)}" placeholder="19:00"><input class="tl-title" value="${escAttr(item.title)}" placeholder="Event title"><input class="tl-desc" value="${escAttr(item.description)}" placeholder="Description"><div style="display:flex;gap:5px"><button class="btn btn-soft up" type="button">↑</button><button class="btn btn-soft down" type="button">↓</button><button class="btn btn-danger remove" type="button">×</button></div></div>`;
  const sync=()=>{item.time=el.querySelector('.tl-time').value;item.title=el.querySelector('.tl-title').value;item.description=el.querySelector('.tl-desc').value};el.querySelectorAll('input').forEach(x=>x.addEventListener('input',sync));el.querySelector('.remove').addEventListener('click',()=>{config.timeline.splice(i,1);renderEventEditors()});el.querySelector('.up').addEventListener('click',()=>{if(i>0){[config.timeline[i-1],config.timeline[i]]=[config.timeline[i],config.timeline[i-1]];renderEventEditors()}});el.querySelector('.down').addEventListener('click',()=>{if(i<config.timeline.length-1){[config.timeline[i+1],config.timeline[i]]=[config.timeline[i],config.timeline[i+1]];renderEventEditors()}});return el;
}
function makePreEditor(item,i){
  const el=document.createElement('div');el.className='event-editor';el.innerHTML=`<div class="row" style="grid-template-columns:1.2fr .8fr .8fr 1fr auto"><input class="pw-title" value="${escAttr(item.title)}" placeholder="Title"><input class="pw-date" value="${escAttr(item.date)}" placeholder="Date"><input class="pw-time" value="${escAttr(item.time)}" placeholder="Time"><input class="pw-place" value="${escAttr(item.place)}" placeholder="Place"><div style="display:flex;gap:5px"><button class="btn btn-soft up" type="button">↑</button><button class="btn btn-soft down" type="button">↓</button><button class="btn btn-danger remove" type="button">×</button></div></div><textarea class="pw-desc" placeholder="Description">${escHtml(item.description)}</textarea>`;
  const sync=()=>{item.title=el.querySelector('.pw-title').value;item.date=el.querySelector('.pw-date').value;item.time=el.querySelector('.pw-time').value;item.place=el.querySelector('.pw-place').value;item.description=el.querySelector('.pw-desc').value};el.querySelectorAll('input,textarea').forEach(x=>x.addEventListener('input',sync));el.querySelector('.remove').addEventListener('click',()=>{config.preWedding.splice(i,1);renderEventEditors()});el.querySelector('.up').addEventListener('click',()=>{if(i>0){[config.preWedding[i-1],config.preWedding[i]]=[config.preWedding[i],config.preWedding[i-1]];renderEventEditors()}});el.querySelector('.down').addEventListener('click',()=>{if(i<config.preWedding.length-1){[config.preWedding[i+1],config.preWedding[i]]=[config.preWedding[i],config.preWedding[i+1]];renderEventEditors()}});return el;
}
function escAttr(v){return String(v??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')};function escHtml(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

async function saveSettings(){
  try{const buttons=[...document.querySelectorAll('.save-btn')];buttons.forEach(b=>b.disabled=true);const result=await apiPost({action:'save_settings',token:state.token,config});config=result.config;hydrateFields();renderEventEditors();updatePreview();showNotice('Settings saved successfully. All devices will receive the new server-side configuration.','success')}catch(err){showNotice(err.message,'error')}finally{document.querySelectorAll('.save-btn').forEach(b=>b.disabled=false)}}

async function loadRSVP(){try{const result=await apiGet('list',`token=${encodeURIComponent(state.token)}`);rsvps=result.rsvps||[];renderStats();renderRSVP()}catch(err){showNotice(err.message,'error')}}
function renderRSVP(){const q=$('rsvpSearch').value.toLowerCase().trim();const filter=$('rsvpFilter').value;const rows=rsvps.filter(r=>(!filter||r.status===filter)&&(!q||`${r.guestName} ${r.notes}`.toLowerCase().includes(q)));$('rsvpBody').innerHTML=rows.map(r=>`<tr><td>${escHtml(r.timestamp)}</td><td>${escHtml(r.guestName)}</td><td>${escHtml(r.status)}</td><td>${escHtml(r.attendees)}</td><td>${escHtml(r.notes)}</td></tr>`).join('')||'<tr><td colspan="5">No matching responses.</td></tr>'}

async function changePassword(e){e.preventDefault();const form=e.currentTarget;const currentPassword=form.currentPassword.value;const newPassword=form.newPassword.value;const confirm=form.confirmPassword.value;if(newPassword!==confirm){setPasswordNotice('New passwords do not match.','error');return}try{const result=await apiPost({action:'change_password',token:state.token,currentPassword,newPassword});setPasswordNotice(result.message||'Password changed successfully.','success');form.reset();setTimeout(()=>{sessionStorage.removeItem('weddingAdminToken');state.token='';openLogin();loginNotice('Password changed. Please sign in with the new password.','success')},700)}catch(err){setPasswordNotice(err.message,'error')}}
function setPasswordNotice(msg,type){const el=$('passwordNotice');el.textContent=msg;el.className=`notice ${type} full`;el.classList.remove('hidden')}

if(state.token) openDashboard(); else openLogin();
