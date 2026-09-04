/* ===================== MÓDULO 2: PART NUMBERS ===================== */
(function(){
  const $=id=>document.getElementById(id);
  const COLS=[0,8,9,10,11,23,25]; // A, I, J, K, L, X, Z
  let H=[], HFULL=[], R=[], q='', sort={c:-1,d:1}, last=[];
  function info(html){ $('pn-srcinfo').innerHTML=html; }
  function setData(matrix,label){
    if(!matrix||!matrix.length){ H=[];HFULL=[];R=[]; info('Sin datos cargados.'); render(); return; }
    HFULL=matrix[0].map(x=>String(x==null?'':x).trim());
    const validCols=COLS.filter(i=>i<HFULL.length);
    H=validCols.map(i=>HFULL[i]||'Col '+(i+1));
    R=matrix.slice(1)
      .filter(row=>row.some(c=>String(c==null?'':c).trim()!==''))
      .map(row=>{
        const all=HFULL.map((_,i)=>row[i]==null?'':String(row[i]).trim());
        return {cols:validCols.map(i=>all[i]),all};
      });
    sort={c:-1,d:1}; q=''; $('pn-q').value='';
    $('pn-count').textContent=R.length.toLocaleString('en-US');
    $('pn-cols').textContent=H.length;
    info(label?`Fuente: <b>${esc(label)}</b> · ${R.length.toLocaleString('en-US')} filas · cargado ${new Date().toLocaleString('es-EC')}`
              :'Sin datos cargados.');
    render();
  }
  function filtered(){
    let rows=R;
    if(q){ const s=q.toLowerCase(); rows=rows.filter(r=>r.all.some(c=>c.toLowerCase().includes(s))); }
    if(sort.c>=0){ rows=rows.slice().sort((a,b)=>{
      const x=a.cols[sort.c]||'', y=b.cols[sort.c]||'';
      const nx=parseFloat(x.replace(/[^0-9.\-]/g,'')), ny=parseFloat(y.replace(/[^0-9.\-]/g,''));
      const num=x!==''&&y!==''&&!isNaN(nx)&&!isNaN(ny)&&/^[\s$.,0-9\-]+$/.test(x)&&/^[\s$.,0-9\-]+$/.test(y);
      if(num) return (nx-ny)*sort.d;
      return x<y?-sort.d:x>y?sort.d:0;
    }); }
    return rows;
  }
  function render(){
    const rows=filtered(); last=rows;
    $('pn-head').innerHTML='<tr>'+H.map((h,i)=>`<th data-c="${i}">${esc(h)||'(col '+(i+1)+')'} <span class="ar">${sort.c===i?(sort.d===1?'▲':'▼'):''}</span></th>`).join('')+'</tr>';
    $('pn-head').querySelectorAll('th').forEach(th=>th.onclick=()=>{ const c=+th.dataset.c; if(sort.c===c)sort.d*=-1; else{sort.c=c;sort.d=1;} render(); });
    const view=rows.slice(0,500);
    $('pn-tb').innerHTML=view.map((r,i)=>`<tr class="row-link" data-idx="${i}">`+r.cols.map(c=>`<td title="${esc(c)}">${esc(c)}</td>`).join('')+'</tr>').join('');
    $('pn-shown').textContent=view.length.toLocaleString('en-US');
    $('pn-meta').textContent=H.length?(rows.length+' resultado(s)'+(rows.length>500?' — mostrando los primeros 500':'')):'';
  }
  $('pn-tb').addEventListener('click',e=>{
    const tr=e.target.closest('tr[data-idx]'); if(!tr) return;
    const r=last[+tr.dataset.idx]; if(!r) return;
    openDetail(r.cols[0]||'Detalle', HFULL.map((h,i)=>[h||`Col ${i+1}`,r.all[i]]).filter(([,v])=>v!==''));
  });
  function exportXLSX(){
    if(!last.length){ alert('No hay filas para exportar.'); return; }
    if(typeof XLSX==='undefined'){ alert('Para Excel se necesita conexión a internet.'); return; }
    const d=new Date().toISOString().slice(0,10);
    const ws=XLSX.utils.aoa_to_sheet([H].concat(last.map(r=>r.cols)));
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Part Numbers');
    XLSX.writeFile(wb,'part_numbers_'+d+'.xlsx');
  }
  async function copy(){
    if(!last.length){ alert('No hay filas para copiar.'); return; }
    const out=H.join('\t')+'\n'+last.map(r=>r.cols.map(c=>String(c).replace(/[\t\n]/g,' ')).join('\t')).join('\n');
    try{ await navigator.clipboard.writeText(out); flash('pn-copy'); }
    catch(e){ const ta=document.createElement('textarea');ta.value=out;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');flash('pn-copy');}catch(_){alert('No se pudo copiar.');}ta.remove(); }
  }
  function flash(id){ const b=$(id),o=b.textContent;b.textContent='✓ Copiado';b.classList.add('primary');setTimeout(()=>{b.textContent=o;b.classList.remove('primary');},1500); }
  function loadFile(f){
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    if(ext==='xlsx'||ext==='xls'){
      if(typeof XLSX==='undefined'){ alert('Para leer Excel se necesita conexión a internet. Usa CSV si estás sin conexión.'); return; }
      const rd=new FileReader();
      rd.onload=()=>{ try{
        const wb=XLSX.read(new Uint8Array(rd.result),{type:'array'});
        let combined=null;
        for(const name of wb.SheetNames){
          const m=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:false,defval:''});
          if(!m.length) continue;
          if(!combined) combined=m;
          else combined=combined.concat(m.slice(1));
        }
        const label=wb.SheetNames.length>1?`${f.name} (${wb.SheetNames.length} hojas: ${wb.SheetNames.join(', ')})`:f.name;
        setData(combined||[],label);
      }catch(e){ alert('No pude leer el Excel: '+e.message); } };
      rd.readAsArrayBuffer(f);
    }else{
      const rd=new FileReader(); rd.onload=()=>setData(parseCSV(rd.result),f.name); rd.readAsText(f,'utf-8');
    }
  }
  const drop=$('pn-drop'),file=$('pn-file');
  drop.onclick=()=>file.click();
  file.onchange=e=>{const f=e.target.files[0];if(f)loadFile(f);};
  ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));
  drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)loadFile(f);});
  $('pn-q').oninput=e=>{q=e.target.value;render();};
  $('pn-export').onclick=exportXLSX;
  $('pn-copy').onclick=copy;
  setData([], '');
})();
