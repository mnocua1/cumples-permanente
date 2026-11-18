{
const $=s=>document.querySelector(s);
const MES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MC=[['#e8336f','#a81d4d','#fff','#e8336f'],['#ff7438','#c24e1c','#21173a','#e0571c'],['#ffc93c','#c9921a','#21173a','#b07a00'],['#14b38c','#0b7d61','#fff','#0f9474'],['#2f7cf6','#1a52ad','#fff','#2f7cf6'],['#7c55f0','#5232b8','#fff','#7c55f0']];
const TAPE=['#ff5c93','#ffc93c','#2f7cf6','#14b38c','#ff7438'];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const src=id=>'/api/foto/'+encodeURIComponent(id);

/* almacenamiento local: claves y "tokens" para poder editar/borrar lo propio */
const LS={get(k,d){try{return JSON.parse(localStorage.getItem('cp_'+k))??d}catch(e){return d}},set(k,v){try{localStorage.setItem('cp_'+k,JSON.stringify(v))}catch(e){}}};
let clave=LS.get('clave',''),adminKey=LS.get('admin',''),mine=LS.get('mine',null),myMsgs=LS.get('msgs',{});
let team=[],msgs=[],isAdmin=false,openId=null,loaded=false;

async function api(path,opt={}){
  const raw=opt.raw;const h={'content-type':raw?raw.type:'application/json'};
  if(clave)h['x-clave']=clave;if(adminKey)h['x-admin']=adminKey;
  Object.assign(h,opt.headers||{});
  const r=await fetch('/api/'+path,{method:opt.method||'GET',headers:h,body:raw||(opt.body?JSON.stringify(opt.body):undefined)});
  let d={};try{d=await r.json()}catch(e){}
  if(r.status===401){askKey();throw new Error('Falta la clave del equipo.')}
  if(!r.ok)throw new Error(d.error||'Algo falló. Intenta de nuevo.');
  return d;
}

function partySvg(seed,balloons){
  let r=(seed*7919)%233280||1;const rnd=()=>(r=(r*9301+49297)%233280)/233280;
  const cols=['#ffc93c','#2f7cf6','#14b38c','#ff7438','#ffffff','#7c55f0'];
  let c='';for(let i=0;i<36;i++){const x=(rnd()*600).toFixed(0),y=(rnd()*360).toFixed(0),k=cols[i%cols.length],a=(rnd()*180).toFixed(0);
    c+=i%3?`<rect x="${x}" y="${y}" width="12" height="5" rx="2" fill="${k}" transform="rotate(${a} ${x} ${y})"/>`:`<circle cx="${x}" cy="${y}" r="4.5" fill="${k}"/>`}
  let b='';if(balloons)[[468,118,'#ffc93c'],[532,82,'#2f7cf6'],[566,158,'#14b38c']].forEach(([x,y,k])=>{
    b+=`<g class="bl"><path d="M${x} ${y+52} q-10 40 6 80 t-4 100" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.6"/><ellipse cx="${x}" cy="${y}" rx="38" ry="46" fill="${k}"/><ellipse cx="${x-13}" cy="${y-17}" rx="8" ry="14" fill="#fff" opacity=".45"/><path d="M${x-7} ${y+45} l7 9 l7 -9z" fill="${k}"/></g>`});
  return `<svg class="party" viewBox="0 0 600 360" preserveAspectRatio="xMaxYMid slice" aria-hidden="true"><g opacity=".55">${c}</g>${b}</svg>`;
}
document.querySelectorAll('svg[data-party]').forEach(e=>{e.outerHTML=partySvg(3,false)});

for(let d=1;d<=31;d++)$('#fDay').insertAdjacentHTML('beforeend',`<option value="${d}">${d}</option>`);
MES.forEach((m,i)=>$('#fMonth').insertAdjacentHTML('beforeend',`<option value="${i+1}">${m[0].toUpperCase()+m.slice(1)}</option>`));
$('#mName').value=LS.get('author','');

const status=t=>{$('#status').textContent=t||''};
const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]||'').join('').toUpperCase();
const av=p=>p.photo?`<img class="av" src="${src(p.photo)}" alt="">`:`<span class="av">${esc(initials(p.name))}</span>`;
function daysTo(m,d){const n=new Date();const t=new Date(n.getFullYear(),n.getMonth(),n.getDate());let c=new Date(t.getFullYear(),m-1,d);if(c<t)c=new Date(t.getFullYear()+1,m-1,d);return Math.round((c-t)/864e5)}
const inLabel=n=>n===0?'¡Es hoy!':n===1?'Mañana':`En ${n} días`;
const valid=p=>p&&p.name&&p.month>=1&&p.month<=12&&p.day>=1&&p.day<=31;
const count=id=>msgs.filter(m=>m.to===id).length;
const myEntry=()=>mine&&team.find(p=>p.id===mine.id);

function render(){
  const ppl=team.filter(valid).map(p=>({...p,left:daysTo(p.month,p.day)})).sort((a,b)=>a.left-b.left);
  $('#regBtn').textContent=myEntry()?'Editar mi registro':'Registrar mi cumpleaños';
  $('#adminBtn').textContent=isAdmin?'Salir del modo administradora':'Soy administradora';
  const hero=$('#hero');
  if(!ppl.length){
    hero.innerHTML=loaded?`<div class="emptybig"><h2>Aún no hay cumpleaños</h2><p>Sé la primera persona en registrarse y comparte el enlace con el equipo.</p><button type="button" data-reg>Registrar mi cumpleaños</button></div>`:'';
  }else{
    const n=ppl[0],today=ppl.filter(p=>p.left===0),rest=ppl.slice(1,6);
    hero.innerHTML=`<div class="next" tabindex="0" role="button" data-open="${esc(n.id)}" aria-label="Abrir el muro de ${esc(n.name)}">${partySvg(n.day*13+n.month,true)}
      <div class="when">${today.length>1?`Hoy cumplen ${today.length} personas`:today.length?'Hoy celebramos a':'Próximo cumpleaños'} · <span class="pill">${inLabel(n.left)}</span></div>
      <div class="day">${n.day}<span>de ${MES[n.month-1]}</span></div>
      <div><div class="who">${av(n)}<b>${esc(n.name)}</b></div>
      ${n.verse?`<p class="verse">“${esc(n.verse.length>140?n.verse.slice(0,140)+'…':n.verse)}” ${n.ref?'— '+esc(n.ref):''}</p>`:''}</div></div>
      <div class="soon"><h3>Lo que viene</h3>${rest.length?rest.map(p=>`<button type="button" class="row" data-open="${esc(p.id)}"><span class="d">${p.day}</span><span class="n">${esc(p.name)}<br><span class="m">${MES[p.month-1]}</span></span><span class="in">${inLabel(p.left)}</span></button>`).join(''):'<p class="lead">Cuando más personas se registren, aparecerán aquí.</p>'}</div>`;
  }
  const cm=new Date().getMonth();
  $('#months').innerHTML=MES.map((m,i)=>{
    const list=team.filter(valid).filter(p=>p.month===i+1).sort((a,b)=>a.day-b.day),k=MC[i%6];
    return `<div class="month${i===cm?' now':''}" style="--mc:${k[0]};--mc2:${k[1]};--mt:${k[2]};--mc3:${k[3]}"><h3>${m}<small>${list.length?list.length+(list.length>1?' personas':' persona'):''}</small></h3><div class="list">${list.length?list.map(p=>`<button type="button" class="person" data-open="${esc(p.id)}"><span class="d">${p.day}</span>${av(p)}<span class="n">${esc(p.name)}</span><span class="c" title="mensajes">${count(p.id)||''}</span></button>`).join(''):'<div class="empty">Sin cumpleaños todavía</div>'}</div></div>`;
  }).join('');
  if(openId)renderWall();
}

function renderWall(){
  const p=team.find(t=>t.id===openId);
  if(!p){close('#wallOv');return}
  $('#wHead').innerHTML=`<div class="phead">${partySvg(p.day*31+p.month,true)}<div class="prof">${av(p)}<div><h2 id="wName">${esc(p.name)}</h2><p><span class="pill">${p.day} de ${MES[p.month-1]}</span>${inLabel(daysTo(p.month,p.day))}</p></div></div></div>
    ${p.verse?`<div style="padding:28px clamp(20px,4vw,40px) 0"><blockquote class="bigverse"><q>${esc(p.verse)}</q>${p.ref?`<cite>${esc(p.ref)}</cite>`:''}</blockquote></div>`:''}`;
  $('#wFirst').textContent=String(p.name).split(' ')[0];
  const list=msgs.filter(m=>m.to===openId).sort((a,b)=>b.at-a.at);
  $('#wList').innerHTML=list.length?list.map((m,j)=>{
    const date=m.at?new Date(m.at).toLocaleDateString('es-CO',{day:'numeric',month:'short'}):'';
    const del=(myMsgs[m.id]||isAdmin)?`<button type="button" class="link" data-del="${esc(m.id)}">Borrar</button>`:'';
    return `<div class="card" style="--r:${[-1.6,1.2,-.6,1.8,-1.1][j%5]}deg;--tape:${TAPE[j%5]}">${m.photo?`<img src="${src(m.photo)}" alt="Foto compartida por ${esc(m.author)}" loading="lazy">`:''}<p>${esc(m.text)}</p><div class="by"><span>${esc(m.author||'Alguien del equipo')} · ${date}</span>${del}</div></div>`;
  }).join(''):'<p class="lead" style="grid-column:1/-1">Todavía no hay mensajes. ¡Sé quien escriba el primero!</p>';
  const self=mine&&p.id===mine.id;
  $('#ownerTools').innerHTML=(isAdmin||self)?`<button type="button" class="link" data-rmp="${esc(p.id)}">${self&&!isAdmin?'Quitarme del tablero':'Quitar a esta persona del tablero'}</button>`:'';
}

/* confeti */
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const FXC=['#ff5c93','#ffc93c','#2f7cf6','#14b38c','#ff7438','#7c55f0'];
const cv=document.createElement('canvas');cv.className='fx';cv.setAttribute('aria-hidden','true');document.body.appendChild(cv);
const cx=cv.getContext('2d');let P=[],running=false,rainUntil=0,dpr=1;
function size(){dpr=Math.min(2,devicePixelRatio||1);cv.width=innerWidth*dpr;cv.height=innerHeight*dpr}
size();addEventListener('resize',size);
function piece(x,y,vx,vy,rain){return{x,y,vx,vy,rain,r:Math.random()*6.3,vr:(Math.random()-.5)*.3,w:7+Math.random()*7,h:4+Math.random()*4,c:FXC[(Math.random()*6)|0],t:Math.random()*6.3,round:Math.random()<.25}}
function burst(x=innerWidth/2,y=innerHeight/3,n=140){
  if(RM)return;
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=4+Math.random()*9;P.push(piece(x,y,Math.cos(a)*s,Math.sin(a)*s-6,false))}
  go();
}
function rain(ms=8000){if(RM)return;rainUntil=Math.max(rainUntil,performance.now()+ms);go()}
function go(){if(!running){running=true;requestAnimationFrame(tick)}}
function tick(now){
  const W=innerWidth,H=innerHeight;
  if(now<rainUntil&&P.length<260)for(let i=0;i<3;i++)P.push(piece(Math.random()*W,-20,(Math.random()-.5)*1.5,1.5+Math.random()*2.5,true));
  cx.setTransform(dpr,0,0,dpr,0,0);cx.clearRect(0,0,W,H);
  P=P.filter(p=>p.y<H+30&&p.x>-60&&p.x<W+60);
  for(const p of P){
    if(p.rain){p.t+=.05;p.x+=p.vx+Math.sin(p.t)*.8;p.y+=p.vy}
    else{p.vy+=.28;p.vx*=.985;p.vy*=.985;p.x+=p.vx;p.y+=p.vy}
    p.r+=p.vr;
    cx.save();cx.translate(p.x,p.y);cx.rotate(p.r);cx.fillStyle=p.c;
    if(p.round){cx.beginPath();cx.arc(0,0,p.h*.8,0,6.3);cx.fill()}else cx.fillRect(-p.w/2,-p.h/2,p.w,p.h*Math.abs(Math.cos(p.t*2+p.r)));
    cx.restore();
  }
  if(P.length||now<rainUntil)requestAnimationFrame(tick);else{running=false;cx.clearRect(0,0,W,H)}
}
const at=el=>{const r=el.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]};
let rained=false;

/* paneles */
function open(sel){$(sel).classList.add('on');document.body.style.overflow='hidden'}
function close(sel){$(sel).classList.remove('on');if(!document.querySelector('.ov.on'))document.body.style.overflow='';if(sel==='#wallOv')openId=null}
document.querySelectorAll('.ov').forEach(o=>o.addEventListener('click',e=>{if(e.target===o||e.target.closest('[data-close]'))close('#'+o.id)}));
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')document.querySelectorAll('.ov.on').forEach(o=>{if(o.id!=='keyOv'||isAdmin||clave)close('#'+o.id)});
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.next[data-open]')){e.preventDefault();openWall(e.target.dataset.open)}
});
function openWall(id){openId=id;renderWall();open('#wallOv');$('#msgErr').textContent='';const p=team.find(t=>t.id===id);if(p&&daysTo(p.month,p.day)===0)rain(4500)}
document.addEventListener('click',e=>{
  const o=e.target.closest('[data-open]');if(o){openWall(o.dataset.open);return}
  if(e.target.closest('[data-reg]'))openReg();
});
$('#regBtn').addEventListener('click',openReg);

/* clave del equipo y modo administradora */
let keyMode='team';
function askKey(mode='team'){
  keyMode=mode;$('#kVal').value='';$('#keyErr').textContent='';
  $('#keyTitle').textContent=mode==='admin'?'Modo administradora':'Clave del equipo';
  $('#keyLead').textContent=mode==='admin'?'Con la clave de administradora puedes borrar mensajes o personas.':'Escribe la clave que te compartió el equipo para entrar.';
  $('#keyCancel').style.display=mode==='admin'?'':'none';
  open('#keyOv');setTimeout(()=>$('#kVal').focus(),50);
}
$('#adminBtn').addEventListener('click',()=>{if(isAdmin){adminKey='';LS.set('admin','');isAdmin=false;render()}else askKey('admin')});
$('#keyForm').addEventListener('submit',async e=>{
  e.preventDefault();const v=$('#kVal').value.trim();if(!v)return;
  if(keyMode==='admin'){adminKey=v}else{clave=v}
  try{await load();
    if(keyMode==='admin'&&!isAdmin){adminKey='';$('#keyErr').textContent='Esa clave no es correcta.';return}
    LS.set('clave',clave);LS.set('admin',adminKey);close('#keyOv');
  }catch(err){if(keyMode==='team'){clave='';}$('#keyErr').textContent='Esa clave no es correcta.'}
});

/* registro */
function openReg(){
  const m=myEntry()||{};
  $('#fName').value=m.name||'';$('#fDay').value=m.day||1;$('#fMonth').value=m.month||new Date().getMonth()+1;
  $('#fVerse').value=m.verse||'';$('#fRef').value=m.ref||'';$('#fPhoto').value='';
  const pv=$('#fPrev');if(m.photo){pv.src=src(m.photo);pv.style.display='block'}else pv.style.display='none';
  $('#regErr').textContent='';open('#regOv');setTimeout(()=>$('#fName').focus(),50);
}
function preview(inp,img){inp.addEventListener('change',()=>{const f=inp.files[0];if(f){img.src=URL.createObjectURL(f);img.style.display='block'}})}
preview($('#fPhoto'),$('#fPrev'));preview($('#mPhoto'),$('#mPrev'));

async function shrink(file){
  const b=await createImageBitmap(file);const k=Math.min(1,1280/Math.max(b.width,b.height));
  const c=document.createElement('canvas');c.width=Math.round(b.width*k);c.height=Math.round(b.height*k);
  c.getContext('2d').drawImage(b,0,0,c.width,c.height);
  let q=.82,out;do{out=await new Promise(r=>c.toBlob(r,'image/jpeg',q));q-=.15}while(out&&out.size>1700*1024&&q>.3);
  if(!out)throw new Error('blob');return out;
}
async function upload(file){
  if(!file)return null;
  let blob;try{blob=await shrink(file)}catch(e){throw new Error('No pudimos leer esa foto. Prueba con una JPG o PNG.')}
  return (await api('foto',{method:'POST',raw:blob})).id;
}

$('#regForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const name=$('#fName').value.trim(),day=+$('#fDay').value,month=+$('#fMonth').value;
  if(!name){$('#regErr').textContent='Escribe tu nombre.';return}
  const maxD=new Date(2024,month,0).getDate();
  if(day>maxD){$('#regErr').textContent=`${MES[month-1]} solo tiene ${maxD} días.`;return}
  const btn=$('#regSave');btn.disabled=true;btn.textContent='Guardando…';$('#regErr').textContent='';
  try{
    const prev=myEntry()||{};const f=$('#fPhoto').files[0];
    const photo=f?await upload(f):(prev.photo||null);
    const body={name,day,month,verse:$('#fVerse').value.trim(),ref:$('#fRef').value.trim(),photo};
    if(prev.id){body.id=prev.id;body.token=mine.token}
    const r=await api('team',{method:'POST',body});
    mine={id:r.id,token:r.token||mine?.token};LS.set('mine',mine);
    const [bx,by]=at(btn);close('#regOv');burst(bx,by,170);await load();
  }catch(err){$('#regErr').textContent=err.message}
  btn.disabled=false;btn.textContent='Guardar';
});

$('#msgForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const author=$('#mName').value.trim(),text=$('#mText').value.trim();
  if(!author){$('#msgErr').textContent='Escribe tu nombre.';return}
  if(!text){$('#msgErr').textContent='Escribe tu mensaje.';return}
  const btn=$('#msgSave');btn.disabled=true;btn.textContent='Publicando…';$('#msgErr').textContent='';
  try{
    const f=$('#mPhoto').files[0];const photo=f?await upload(f):null;
    const r=await api('msgs',{method:'POST',body:{to:openId,author,text,photo}});
    burst(...at(btn));myMsgs[r.id]=r.token;LS.set('msgs',myMsgs);LS.set('author',author);
    $('#mText').value='';$('#mPhoto').value='';$('#mPrev').style.display='none';
    await load();
  }catch(err){$('#msgErr').textContent=err.message}
  btn.disabled=false;btn.textContent='Publicar mensaje';
});

/* borrar con confirmación */
document.addEventListener('click',async e=>{
  const d=e.target.closest('[data-del],[data-rmp]');if(!d)return;
  if(d.dataset.sure!=='1'){const t=d.textContent;d.dataset.sure='1';d.textContent='¿Seguro? Toca otra vez';setTimeout(()=>{if(d.isConnected){d.dataset.sure='';d.textContent=t}},4000);return}
  try{
    if(d.dataset.del){await api('msgs/'+d.dataset.del,{method:'DELETE',headers:{'x-token':myMsgs[d.dataset.del]||''}})}
    else{const id=d.dataset.rmp;await api('team/'+id,{method:'DELETE',headers:{'x-token':mine&&mine.id===id?mine.token:''}});if(mine&&mine.id===id){mine=null;LS.set('mine',null)}close('#wallOv')}
    await load();
  }catch(err){$('#msgErr').textContent=err.message}
});

/* datos */
async function load(){
  const d=await api('data');
  team=d.team||[];msgs=d.msgs||[];isAdmin=!!d.admin;loaded=true;status('');render();
  if(!rained&&team.some(p=>valid(p)&&daysTo(p.month,p.day)===0)){rained=true;setTimeout(()=>rain(9000),400)}
}
async function boot(){
  const t=setTimeout(()=>{if(!loaded)status('Esto está tardando más de lo normal. Revisa tu conexión.')},10000);
  try{await load()}catch(e){if(!/clave/.test(e.message))status('No pudimos cargar el tablero. '+e.message)}
  clearTimeout(t);
}
boot();
setInterval(()=>{if(loaded&&!document.hidden&&!document.querySelector('#regOv.on,#keyOv.on'))load().catch(()=>{})},30000);
render();
}
