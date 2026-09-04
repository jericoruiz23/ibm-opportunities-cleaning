const SEED = [];
const TODAY = new Date().toISOString().slice(0,10);
let DATA = SEED;
let chartInst = null;
let state = {q:"",bp:"",clSel:null,cf:"",ct:"",ef:"",et:"",stages:new Set(),plats:new Set(),sort:"val",dir:-1,onlyExp:false};
const NOCLIENT="(sin nombre)";
const fmt = n => "$"+Math.round(n).toLocaleString("en-US");
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- normaliza fechas a YYYY-MM-DD ---------- */
function normDate(v){
  if(v==null) return ''; v=String(v).trim(); if(!v||v.toLowerCase()==='nan') return '';
  let m=v.match(/^(\d{4})-(\d{2})-(\d{2})/); if(m) return m[1]+'-'+m[2]+'-'+m[3];
  m=v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if(m){ let mo=+m[1],d=+m[2],y=+m[3]; if(y<100)y+=2000;
    return y+'-'+String(mo).padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
  if(/^\d+(\.\d+)?$/.test(v)){ const n=parseFloat(v); if(n>20000&&n<60000){ const d2=new Date(Date.UTC(1899,11,30)+Math.round(n)*86400000); return d2.toISOString().slice(0,10);} }
  const d3=new Date(v); if(!isNaN(d3.getTime())) return d3.toISOString().slice(0,10);
  return '';
}
/* ---------- CSV parser ---------- */
function parseCSV(text){
  if(text.charCodeAt(0)===0xFEFF) text=text.slice(1);
  const rows=[]; let row=[], val="", q=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(q){
      if(c==='"'){ if(text[i+1]==='"'){val+='"';i++;} else q=false; }
      else val+=c;
    }else{
      if(c==='"') q=true;
      else if(c===','){ row.push(val); val=""; }
      else if(c==='\n'){ row.push(val); rows.push(row); row=[]; val=""; }
      else if(c==='\r'){ /* skip */ }
      else val+=c;
    }
  }
  if(val.length||row.length){ row.push(val); rows.push(row); }
  return rows;
}
function norm(h){ return h.replace(/^﻿/,'').trim().toLowerCase(); }
function mapRows(matrix){
  if(!matrix.length) return [];
  // Auto-detect header row — some exports have metadata rows before the real header
  const ANCHORS=['stage','opportunity name','customer name','opportunity number','close date'];
  let headerRow=0;
  for(let i=0;i<Math.min(20,matrix.length);i++){
    const test=matrix[i].map(norm);
    if(ANCHORS.some(n=>test.includes(n))){ headerRow=i; break; }
  }
  const head=matrix[headerRow].map(norm);
  const find=(...names)=>{ for(const n of names){ const i=head.indexOf(n); if(i>=0) return i; } return -1; };
  const iCust  = find('customer name','account name','end user account','end user name','client name','account');
  const iOpp   = find('opportunity name','opp name','opportunity','opportunity title','name');
  const iNum   = find('opportunity number','opp number','opportunity id','opportunity #','number','id');
  const iStage = find('stage','sales stage','opportunity stage','status','opp stage');
  const iPlat  = find('platform type','platform','solution type','technology','product type','brand');
  const iVal   = find('estimated sales value (usd)','bp estimated sales value','estimated sales value','amount (usd)','amount','revenue','value (usd)','value','total value','deal value');
  const iExp   = find('deal registration expiry date (yyyy-mm-dd)','deal registration expiry date','expiry date','registration expiry date','expiry','expiration date','reg expiry');
  const iClose = find('close date (yyyy-mm-dd)','close date','expected close date','closing date','projected close date','est. close date');
  const iOwner = find('opportunity owner','owner','sales rep','seller','assigned to','sales owner');
  const iBp    = find('business partner - ceid','business partner','partner name','reseller','bp name','partner','bp');
  if(iStage<0 && iCust<0 && iOpp<0){
    alert('No se reconocieron las columnas del archivo. Asegúrate de que sea un reporte de oportunidades compatible.');
    return null;
  }
  const out=[];
  for(let r=headerRow+1;r<matrix.length;r++){
    const a=matrix[r]; if(!a||a.every(c=>!c||String(c).trim()==='')) continue;
    const g=i=> i>=0&&i<a.length ? (a[i]||'').trim() : '';
    const dt=v=>normDate(g(v));
    const cust=g(iCust);
    out.push({cust:(!cust||cust==='-'||cust==='--')?NOCLIENT:cust,
      opp:g(iOpp),num:g(iNum),stage:g(iStage),plat:g(iPlat),
      val:Math.round(parseFloat(g(iVal).replace(/[^0-9.\-]/g,''))||0),
      close:dt(iClose),exp:dt(iExp),owner:g(iOwner),bp:g(iBp)});
  }
  return out;
}

/* ---------- carga de datos ---------- */
function setData(rows,label){
  DATA=rows;
  const present=[...new Set(rows.map(r=>r.stage))].sort();
  state.stages=new Set(present.filter(s=>s!=='Lost'));
  buildStages(present);
  const platsPresent=[...new Set(rows.map(r=>r.plat).filter(Boolean))].sort();
  state.plats=new Set(platsPresent);
  buildPlats(platsPresent);
  buildSelect('bp','bp','(Todos los BP)');
  state.clSel=null;
  buildClientMulti();
  const expd=rows.filter(r=>r.exp&&r.exp<TODAY).length;
  document.getElementById('srcinfo').innerHTML = rows.length
    ? `Fuente: <b>${esc(label)}</b> · ${rows.length.toLocaleString('en-US')} filas · ${expd} con registro vencido · cargado ${new Date().toLocaleString('es-EC')}`
    : `Sin datos cargados.`;
  apply();
}
function buildStages(present){
  const sc=document.getElementById('stages'); sc.innerHTML='';
  present.forEach(s=>{ const c=document.createElement('span');
    c.className='chip'+(state.stages.has(s)?' on':''); c.textContent=s;
    c.onclick=()=>{ c.classList.toggle('on'); c.classList.contains('on')?state.stages.add(s):state.stages.delete(s); apply(); };
    sc.appendChild(c); });
}
function buildPlats(present){
  const sc=document.getElementById('plats'); sc.innerHTML='';
  present.forEach(s=>{ const c=document.createElement('span');
    c.className='chip'+(state.plats.has(s)?' on':''); c.textContent=s;
    c.onclick=()=>{ c.classList.toggle('on'); c.classList.contains('on')?state.plats.add(s):state.plats.delete(s); apply(); };
    sc.appendChild(c); });
}
function buildSelect(id,key,allLabel){
  const el=document.getElementById(id);
  const vals=[...new Set(DATA.map(r=>r[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  el.innerHTML='<option value="">'+allLabel+'</option>'+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  el.value = id==='bp' ? state.bp : '';
}

/* ---------- filtros ---------- */
function inRange(d,from,to){ if(!d) return false; if(from&&d<from) return false; if(to&&d>to) return false; return true; }
function passDates(r){
  const cS=state.cf||state.ct, eS=state.ef||state.et;
  if(!cS&&!eS) return true;
  const cOk=cS?inRange(r.close,state.cf,state.ct):null, eOk=eS?inRange(r.exp,state.ef,state.et):null;
  if(cS&&!eS) return cOk; if(eS&&!cS) return eOk;
  return cOk||eOk;
}
function passQ(r){ if(!state.q) return true; const s=state.q.toLowerCase();
  return (r.cust+' '+r.opp+' '+r.num).toLowerCase().includes(s); }
function passClient(r){
  if(r.cust===NOCLIENT) return true;
  if(state.clSel===null) return true;
  return state.clSel.has(r.cust);
}
let CLIENTS=[];
let lastFiltered=[];
const EXPORT_COLS=[['Cliente','cust'],['Oportunidad','opp'],['# Oportunidad','num'],['Business Partner','bp'],['Stage','stage'],['Plataforma','plat'],['Valor (USD)','val'],['Close date','close'],['Expiry date','exp'],['Owner','owner']];
function exportXLSX(){
  if(!lastFiltered.length){ alert('No hay filas para exportar con los filtros actuales.'); return; }
  const d=new Date().toISOString().slice(0,10);
  if(typeof XLSX==='undefined'){
    if(confirm('Para generar Excel se necesita la librería (conexión a internet). ¿Descargo en CSV en su lugar?')) exportCSV(d);
    return;
  }
  const header=EXPORT_COLS.map(c=>c[0]);
  const aoa=[header].concat(lastFiltered.map(r=>EXPORT_COLS.map(c=>{
    if(c[1]==='val') return Number(r.val)||0;
    return r[c[1]]==null?'':r[c[1]];
  })));
  const ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=[{wch:30},{wch:42},{wch:20},{wch:26},{wch:11},{wch:13},{wch:14},{wch:12},{wch:12},{wch:22}];
  ws['!autofilter']={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:aoa.length-1,c:header.length-1}})};
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Oportunidades');
  XLSX.writeFile(wb,'oportunidades_filtradas_'+d+'.xlsx');
}
function exportCSV(d){
  d=d||new Date().toISOString().slice(0,10);
  const esc=v=>{ v=(v==null?'':String(v)); return /[",\n;]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; };
  let out=EXPORT_COLS.map(c=>c[0]).join(',')+'\n';
  out+=lastFiltered.map(r=>EXPORT_COLS.map(c=>esc(r[c[1]])).join(',')).join('\n');
  const blob=new Blob(['﻿'+out],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download='oportunidades_filtradas_'+d+'.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
async function copyTable(){
  if(!lastFiltered.length){ alert('No hay filas para copiar con los filtros actuales.'); return; }
  let out=EXPORT_COLS.map(c=>c[0]).join('\t')+'\n';
  out+=lastFiltered.map(r=>EXPORT_COLS.map(c=>{let v=(r[c[1]]==null?'':String(r[c[1]])); return v.replace(/[\t\n]/g,' ');}).join('\t')).join('\n');
  try{ await navigator.clipboard.writeText(out); flashBtn('copybtn','✓ Copiado'); }
  catch(e){ const ta=document.createElement('textarea'); ta.value=out; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); flashBtn('copybtn','✓ Copiado'); }catch(_){ alert('No se pudo copiar automáticamente.'); } ta.remove(); }
}
function flashBtn(id,txt){ const b=document.getElementById(id), o=b.textContent; b.textContent=txt; b.classList.add('primary'); setTimeout(()=>{b.textContent=o;b.classList.remove('primary');},1500); }
function buildClientMulti(){
  CLIENTS=[...new Set(DATA.map(r=>r.cust).filter(c=>c&&c!==NOCLIENT))].sort((a,b)=>a.localeCompare(b));
  renderClientList(''); updateClBtn();
}
function renderClientList(filter){
  const list=document.getElementById('cl-list'); const f=(filter||'').toLowerCase();
  const sel=state.clSel;
  list.innerHTML=CLIENTS.filter(c=>!f||c.toLowerCase().includes(f)).map(c=>{
    const on = sel===null || sel.has(c);
    return `<label class="ms-item"><input type="checkbox" data-c="${esc(c)}" ${on?'checked':''}/> ${esc(c)}</label>`;
  }).join('') || '<div style="font-size:12px;color:var(--muted);padding:6px">Sin coincidencias</div>';
  list.querySelectorAll('input').forEach(cb=>cb.onchange=()=>{
    if(state.clSel===null) state.clSel=new Set(CLIENTS);
    cb.checked ? state.clSel.add(cb.dataset.c) : state.clSel.delete(cb.dataset.c);
    if(state.clSel.size===CLIENTS.length) state.clSel=null;
    updateClBtn(); apply();
  });
}
function updateClBtn(){
  const b=document.getElementById('cl-btn'); const s=state.clSel;
  if(s===null) b.textContent='Todos los clientes ▾';
  else if(s.size===0) b.textContent='Ningún cliente ▾';
  else if(s.size===1) b.textContent=[...s][0]+' ▾';
  else b.textContent=s.size+' clientes ▾';
}

function apply(){
  let rows=DATA.filter(r=>state.stages.has(r.stage) && state.plats.has(r.plat)
    && (!state.bp||r.bp===state.bp) && passClient(r)
    && (!state.onlyExp || (r.exp && r.exp<TODAY))
    && passQ(r) && passDates(r));
  const k=state.sort,dir=state.dir;
  rows.sort((a,b)=>{ let x=a[k],y=b[k];
    if(k==='val') return (x-y)*dir; x=x||""; y=y||""; return x<y?-dir:x>y?dir:0; });
  lastFiltered=rows;
  const total=rows.reduce((s,r)=>s+r.val,0);
  document.getElementById('m-count').textContent=rows.length.toLocaleString('en-US');
  document.getElementById('m-val').textContent=fmt(total);
  document.getElementById('m-avg').textContent=fmt(rows.length?total/rows.length:0);
  document.getElementById('m-exp').textContent=rows.filter(r=>r.exp&&r.exp<TODAY).length;
  document.getElementById('meta').textContent=rows.length+' resultado(s)'+(rows.length>300?' — mostrando los 300 de mayor valor':'');
  document.querySelectorAll('th').forEach(th=>{const a=th.querySelector('.ar');if(a)a.textContent=th.dataset.k===k?(dir===1?'▲':'▼'):'';});
  const tb=document.getElementById('tb');
  tb.innerHTML=rows.slice(0,300).map((r,i)=>{ const bad=r.exp&&r.exp<TODAY;
    const dias = bad ? Math.round((new Date(TODAY)-new Date(r.exp))/86400000) : 0;
    return `<tr class="row-link" data-idx="${i}"><td class="cust" title="${esc(r.cust)}">${esc(r.cust)}</td>
      <td class="opp" title="${esc(r.opp)}">${esc(r.opp)}</td>
      <td class="bp" title="${esc(r.bp)}">${esc(r.bp)}</td>
      <td><span class="pill s-${esc(r.stage)}">${esc(r.stage)}</span></td>
      <td>${esc(r.plat)}</td><td class="r">${fmt(r.val)}</td>
      <td>${r.close||'—'}</td><td class="${bad?'exp-bad':''}">${r.exp||'—'}${bad?' ⚠ ('+dias+'d)':''}</td>
      <td>${esc(r.owner)}</td></tr>`; }).join('');
  renderCharts(rows);
}

/* ---------- gráficos ---------- */
function renderCharts(rows){
  if(typeof Chart==='undefined') return;
  const grp=document.getElementById('ch-group').value;
  const metric=document.getElementById('ch-metric').value;
  const dateF=document.getElementById('ch-date').value;
  document.getElementById('ch-date-wrap').style.display=grp==='bp'?'none':'flex';
  const map={};
  rows.forEach(r=>{
    let key;
    if(grp==='bp'){ key=r.bp||'(Sin BP)'; }
    else{
      const d=dateF==='close'?r.close:r.exp; if(!d) return;
      if(grp==='month') key=d.slice(0,7);
      else if(grp==='quarter'){ const m=+d.slice(5,7),q=Math.ceil(m/3); key=d.slice(0,4)+'-Q'+q; }
      else key=d.slice(0,4);
    }
    if(!map[key]) map[key]={val:0,count:0};
    map[key].val+=r.val; map[key].count++;
  });
  const keys=Object.keys(map).sort();
  const vals=keys.map(k=>metric==='val'?Math.round(map[k].val):map[k].count);
  const isHoriz=grp==='bp';
  const wrap=document.getElementById('ch-wrap');
  if(!keys.length){
    if(chartInst){chartInst.destroy();chartInst=null;}
    wrap.style.height='48px'; return;
  }
  wrap.style.height=isHoriz?Math.max(180,keys.length*26+50)+'px':'220px';
  const ctx=document.getElementById('ch-canvas').getContext('2d');
  if(chartInst) chartInst.destroy();
  chartInst=new Chart(ctx,{
    type:'bar',
    data:{labels:keys,datasets:[{
      data:vals,
      backgroundColor:'rgba(24,95,165,0.14)',
      borderColor:'#185FA5',
      borderWidth:1.5,
      borderRadius:4
    }]},
    options:{
      indexAxis:isHoriz?'y':'x',
      responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{display:false},
        tooltip:{callbacks:{label:c=>metric==='val'?'$'+Math.round(c.raw).toLocaleString('en-US'):c.raw+' oportunidades'}}
      },
      scales:{
        x:{grid:{color:'#ebebeb'},ticks:{font:{size:11},color:'#6b6b66'}},
        y:{grid:{color:'#ebebeb'},ticks:{font:{size:11},color:'#6b6b66'}}
      }
    }
  });
}

/* ---------- eventos ---------- */
['q','cf','ct','ef','et'].forEach(id=>document.getElementById(id).oninput=e=>{state[id]=e.target.value;apply();});
document.getElementById('bp').onchange=e=>{state.bp=e.target.value;apply();};
const clBtn=document.getElementById('cl-btn'), clPop=document.getElementById('cl-pop');
clBtn.onclick=e=>{ e.stopPropagation(); clPop.hidden=!clPop.hidden; if(!clPop.hidden){document.getElementById('cl-search').value='';renderClientList('');document.getElementById('cl-search').focus();} };
clPop.onclick=e=>e.stopPropagation();
document.addEventListener('click',()=>{ if(!clPop.hidden) clPop.hidden=true; });
document.getElementById('cl-search').oninput=e=>renderClientList(e.target.value);
document.getElementById('cl-all').onclick=()=>{ state.clSel=null; renderClientList(document.getElementById('cl-search').value); updateClBtn(); apply(); };
document.getElementById('cl-none').onclick=()=>{ state.clSel=new Set(); renderClientList(document.getElementById('cl-search').value); updateClBtn(); apply(); };
document.getElementById('exportbtn').onclick=exportXLSX;
document.getElementById('copybtn').onclick=copyTable;
document.getElementById('togglefilters').onclick=()=>{
  const p=document.getElementById('panel'), b=document.getElementById('togglefilters');
  const hidden=p.style.display==='none';
  p.style.display=hidden?'':'none';
  b.textContent=hidden?'Ocultar filtros ▴':'Mostrar filtros ▾';
};
document.querySelectorAll('th').forEach(th=>th.onclick=()=>{const k=th.dataset.k;if(state.sort===k)state.dir*=-1;else{state.sort=k;state.dir=1;}apply();});
document.getElementById('preset').onclick=()=>{
  const q=+document.getElementById('qs').value, y=+document.getElementById('qy').value;
  const m1=String((q-1)*3+1).padStart(2,'0');
  const m2=String(q*3).padStart(2,'0');
  const lastDay=new Date(y,q*3,0).getDate();
  const from=y+'-'+m1+'-01', to=y+'-'+m2+'-'+String(lastDay).padStart(2,'0');
  state.cf=state.ef=from; state.ct=state.et=to;
  document.getElementById('cf').value=from; document.getElementById('ct').value=to;
  document.getElementById('ef').value=from; document.getElementById('et').value=to;
  state.sort='val'; state.dir=-1; state.onlyExp=false; syncVenc(); apply();
};
document.getElementById('reset').onclick=()=>{
  state.q=state.bp=state.cf=state.ct=state.ef=state.et=''; state.sort='val'; state.dir=-1; state.onlyExp=false;
  state.clSel=null;
  ['q','cf','ct','ef','et'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('bp').value='';
  updateClBtn(); clPop.hidden=true;
  document.querySelectorAll('#stages .chip').forEach(c=>{const s=c.textContent;const on=s!=='Lost';c.classList.toggle('on',on);on?state.stages.add(s):state.stages.delete(s);});
  document.querySelectorAll('#plats .chip').forEach(c=>{c.classList.add('on');state.plats.add(c.textContent);});
  syncVenc(); apply();
};
function toggleVenc(force){
  state.onlyExp = (force!==undefined)? force : !state.onlyExp;
  if(state.onlyExp){
    state.cf=state.ct=state.ef=state.et='';
    ['cf','ct','ef','et'].forEach(id=>document.getElementById(id).value='');
    state.sort='exp'; state.dir=1;
  }
  syncVenc(); apply();
}
function syncVenc(){
  const b=document.getElementById('venc'), card=document.getElementById('card-exp');
  b.classList.toggle('primary',state.onlyExp); b.textContent=state.onlyExp?'✓ Solo vencidos':'Ver vencidos';
  card.style.outline = state.onlyExp ? '2px solid #A32D2D' : 'none';
}
document.getElementById('venc').onclick=()=>toggleVenc();
document.getElementById('card-exp').onclick=()=>toggleVenc(true);
['ch-group','ch-metric','ch-date'].forEach(id=>
  document.getElementById(id).onchange=()=>renderCharts(lastFiltered)
);
document.getElementById('tb').addEventListener('click',e=>{
  const tr=e.target.closest('tr[data-idx]'); if(!tr) return;
  const r=lastFiltered[+tr.dataset.idx]; if(!r) return;
  openDetail(r.opp||r.cust,[
    ['Cliente',r.cust],['Oportunidad',r.opp],['# Oportunidad',r.num],
    ['Business Partner',r.bp],['Stage',r.stage],['Plataforma',r.plat],
    ['Valor (USD)',fmt(r.val)],['Close date',r.close||''],['Expiry date',r.exp||''],['Owner',r.owner]
  ],{url:r.num?`https://partnerportal.ibm.com/s/opportunity/${encodeURIComponent(r.num)}`:null,stage:r.stage});
});
const drop=document.getElementById('drop'),file=document.getElementById('file');
drop.onclick=()=>file.click();
file.onchange=e=>{ const f=e.target.files[0]; if(f) loadFile(f); };
['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)loadFile(f);});
function loadFile(f){
  const ext=(f.name.split('.').pop()||'').toLowerCase();
  if(ext==='xlsx'||ext==='xls'){
    if(typeof XLSX==='undefined'){ alert('Para leer Excel se necesita conexión a internet (se carga una librería). Si estás sin conexión, exporta el archivo como CSV.'); return; }
    const rd=new FileReader();
    rd.onload=()=>{ try{
      const wb=XLSX.read(new Uint8Array(rd.result),{type:'array',cellDates:false});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const matrix=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:''});
      const rows=mapRows(matrix); if(rows) setData(rows,f.name);
    }catch(e){ alert('No pude leer el Excel: '+e.message); } };
    rd.readAsArrayBuffer(f);
  }else{
    const rd=new FileReader();
    rd.onload=()=>{ const m=parseCSV(rd.result); const rows=mapRows(m); if(rows) setData(rows,f.name); };
    rd.readAsText(f,'utf-8');
  }
}

/* ---------- init ---------- */
setData(SEED,'');
(function(){
  const now=new Date(), curY=now.getFullYear(), curQ=Math.floor(now.getMonth()/3)+1;
  const qy=document.getElementById('qy');
  for(let y=curY-3;y<=curY+3;y++){
    const o=document.createElement('option');
    o.value=y; o.textContent=y; if(y===curY) o.selected=true; qy.appendChild(o);
  }
  document.getElementById('qs').value=String(curQ);
})();
