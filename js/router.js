/* ===================== ROUTER ===================== */
function showModule(id){
  document.getElementById('home').style.display          = id==='home'        ? 'flex' : 'none';
  document.getElementById('mod-pipeline').style.display   = id==='pipeline'    ? 'block': 'none';
  document.getElementById('mod-partnumbers').style.display= id==='partnumbers' ? 'block': 'none';
  window.scrollTo(0,0);
}
document.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click',()=>showModule(el.dataset.go)));
showModule('home');
