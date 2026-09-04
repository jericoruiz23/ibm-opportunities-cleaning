/* ===================== DETALLE MODAL ===================== */
function openDetail(title,pairs,opts){
  const url=opts&&opts.url, stage=opts&&opts.stage;
  document.getElementById('det-title').textContent=title;
  const badge=document.getElementById('det-badge');
  if(stage){badge.textContent=stage;badge.className='pill s-'+stage;badge.style.display='inline-block';}
  else badge.style.display='none';
  const actions=document.getElementById('det-actions');
  if(url){document.getElementById('det-link').href=url;actions.style.display='block';}
  else actions.style.display='none';
  document.getElementById('det-body').innerHTML=pairs.map(([l,v])=>{
    const sv=(v==null||v==='')?'—':String(v);
    return `<div class="detail-row"><span class="det-lbl">${esc(l)}</span><span class="det-val">${esc(sv)}</span></div>`;
  }).join('');
  document.getElementById('det-ov').style.display='flex';
}
(function(){
  const ov=document.getElementById('det-ov');
  document.getElementById('det-close').onclick=()=>ov.style.display='none';
  ov.onclick=e=>{ if(e.target===ov) ov.style.display='none'; };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') ov.style.display='none'; });
})();
