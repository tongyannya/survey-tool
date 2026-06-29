/* ===== 面板管理 ===== */
function togglePanel(name){panels[name]=!panels[name];updatePanels();}
function updatePanels(){
  const names=['design','points','analysis'],openNames=names.filter(n=>panels[n]),cnt=openNames.length;
  document.getElementById('panelArea').classList.toggle('open',cnt>0);
  names.forEach(n=>{const el=document.getElementById('panel'+n.charAt(0).toUpperCase()+n.slice(1));el.classList.toggle('open',panels[n]);if(!panels[n])el.style.flex='';else if(n==='design')el.style.flex='0 0 auto';else el.style.flex=cnt===1?'0 0 auto':'1';});
  document.getElementById('resizerDp').style.display=(panels.design&&(panels.points||panels.analysis))?'block':'none';
  document.getElementById('resizerPa').style.display=(panels.points&&panels.analysis)?'block':'none';
  document.querySelectorAll('.icon-tab').forEach(t=>t.classList.toggle('active',panels[t.dataset.panel]));
  setTimeout(()=>map.invalidateSize(),50);
}
document.querySelectorAll('.icon-tab').forEach(t=>{t.onclick=()=>togglePanel(t.dataset.panel);});
document.querySelectorAll('.panel-close').forEach(b=>{b.onclick=()=>togglePanel(b.dataset.panel);});

/* ===== 浮动面板 ===== */
function toggleFloat(name){floatOpen=floatOpen===name?null:name;document.getElementById('schemeFloat').classList.toggle('open',floatOpen==='scheme');document.getElementById('toolsFloat').classList.toggle('open',floatOpen==='tools');}
document.querySelectorAll('.float-close').forEach(b=>{b.onclick=()=>{floatOpen=null;document.querySelectorAll('.float-popup').forEach(p=>p.classList.remove('open'));hideHelp();};});
document.addEventListener(`mousedown`,e=>{
  let _dismissed=false;
  if(floatOpen===`scheme`&&!e.target.closest(`#schemeFloat,#fabContainer`)){floatOpen=null;document.getElementById(`schemeFloat`).classList.remove(`open`);hideHelp();_dismissed=true;}
  if(!e.target.closest(`.leaflet-popup,.leaflet-marker-icon,.leaflet-div-icon`)){if(map._popup)_dismissed=true;map.closePopup();}
  if(_dismissed){_popupJustClosed=true;setTimeout(()=>{_popupJustClosed=false;},0);}
});

/* ===== 工具手风琴 ===== */
document.querySelectorAll('.tool-name').forEach(n=>{n.onclick=e=>{if(e.target.closest('.help-dot'))return;n.closest('.tool-item').classList.toggle('open');};});


/* ===== 面板大小调节 ===== */
(function(){
  let dr=null,sY=0,pH1=0,pH2=0,p1=null,p2=null;
  function adj(id){if(id==='resizerDp'){const a=document.getElementById('panelDesign');return panels.points?[a,document.getElementById('panelPoints')]:panels.analysis?[a,document.getElementById('panelAnalysis')]:null;}return[document.getElementById('panelPoints'),document.getElementById('panelAnalysis')];}
  document.querySelectorAll('.panel-resizer').forEach(r=>{r.addEventListener('mousedown',e=>{e.preventDefault();const pair=adj(r.id);if(!pair)return;[p1,p2]=pair;dr=r;sY=e.clientY;pH1=p1.offsetHeight;pH2=p2.offsetHeight;document.body.style.cursor='ns-resize';document.body.style.userSelect='none';});});
  document.addEventListener('mousemove',e=>{if(!dr)return;const dy=e.clientY-sY;p1.style.flex='0 0 '+Math.max(80,pH1+dy)+'px';p2.style.flex='0 0 '+Math.max(80,pH2-dy)+'px';});
  document.addEventListener('mouseup',()=>{if(!dr)return;dr=null;document.body.style.cursor='';document.body.style.userSelect='';});
})();

/* ===== FAB拖拽 ===== */
(function(){
  const c=document.getElementById('fabContainer');let on=false,moved=false,sx,sy,oR,oB;
  c.addEventListener('mousedown',e=>{if(e.target.closest('.float-popup'))return;on=true;moved=false;sx=e.clientX;sy=e.clientY;const pr=c.offsetParent.getBoundingClientRect(),cr=c.getBoundingClientRect();oR=pr.right-cr.right;oB=pr.bottom-cr.bottom;});
  document.addEventListener('mousemove',e=>{if(!on)return;if(Math.abs(e.clientX-sx)+Math.abs(e.clientY-sy)>5){moved=true;c.style.right=Math.max(8,oR-(e.clientX-sx))+'px';c.style.bottom=Math.max(8,oB-(e.clientY-sy))+'px';}});
  document.addEventListener('mouseup',()=>{on=false;if(moved)setTimeout(()=>{moved=false;},0);});
  c.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault();}},true);
  document.getElementById('fabScheme').addEventListener('click',()=>{if(!moved)toggleFloat('scheme');});
  document.getElementById('fabTools').addEventListener('click',()=>{if(!moved)toggleFloat('tools');});
})();

/* ===== 缩放到点位 ===== */
function _fitPts(pts,emptyMsg){
  if(!pts.length){toast(emptyMsg||`没有点位`);return;}
  if(pts.length===1){map.setView(pts[0],16);return;}
  map.fitBounds(L.latLngBounds(pts),{padding:[40,40]});
}
function zoomToFit(){
  const pts=[];
  if(cur===`gnss`){M.gnss.pts.forEach(p=>pts.push(displayLL(p.wgs)));}
  else{M[cur].routes.forEach(r=>{if(!r.hidden)r.pts.forEach(p=>pts.push(displayLL(p.wgs)));});}
  _fitPts(pts,`当前模式没有点位`);
}
function zoomToFitAll(){
  const pts=[];
  M.gnss.pts.forEach(p=>pts.push(displayLL(p.wgs)));
  [`trav`,`lev`].forEach(k=>M[k].routes.forEach(r=>{if(!r.hidden)r.pts.forEach(p=>pts.push(displayLL(p.wgs)));}));
  _fitPts(pts,`没有任何点位`);
}
function zoomToRoute(route){
  _fitPts(route.pts.map(p=>displayLL(p.wgs)),`该路线没有点位`);
}
document.getElementById(`zoomAllBtn`).onclick=zoomToFitAll;
document.querySelectorAll(`.zoom-fit`).forEach(el=>{el.onclick=zoomToFit;});

/* ===== 模式切换与参数 ===== */
function setTabUI(){document.querySelectorAll(`.tab`).forEach(t=>t.classList.toggle(`active`,t.dataset.m===cur));}
function buildParams(){
  const box=document.getElementById(`paramBox`);
  document.getElementById(`modeTitleText`).textContent={gnss:`GNSS 控制网 · 三角网`,trav:`导线 · 附合/闭合`,lev:`水准路线 · 二等往返`}[cur];
  if(cur===`gnss`){
    box.innerHTML=`<div class="btn-row"><button id="subPoint">加点</button><button id="subEdge">连边</button><button id="subTri">选三角</button><button id="autoTri">自动生成三角网</button></div><div class="param" style="margin-top:10px;"><span>最短基线限值 (m)</span><input id="pMinEdge" type="number" value="`+M.gnss.minEdge+`"></div>`;
    subActive(`sub`+(M.gnss.sub===`edge`?`Edge`:M.gnss.sub===`tri`?`Tri`:`Point`));
    document.getElementById(`subPoint`).onclick=()=>{M.gnss.sub=`point`;M.gnss.sel=null;M.gnss.triSel=[];refreshIcons(`gnss`);subActive(`subPoint`);};
    document.getElementById(`subEdge`).onclick=()=>{M.gnss.sub=`edge`;M.gnss.triSel=[];refreshIcons(`gnss`);subActive(`subEdge`);toast(`连边：依次点两个点`);};
    document.getElementById(`subTri`).onclick=()=>{M.gnss.sub=`tri`;M.gnss.sel=null;refreshIcons(`gnss`);subActive(`subTri`);toast(`选三角：依次点三个点`);};
    document.getElementById(`autoTri`).onclick=autoTriangulate;
    document.getElementById(`pMinEdge`).onchange=e=>{M.gnss.minEdge=+e.target.value||0;refresh();};
  }else if(cur===`trav`){
    box.innerHTML=`<div class="param"><span>相邻边长比上限 1:</span><input id="pRatio" type="number" value="`+M.trav.maxRatio+`"></div><div class="param"><span>转折角提示下限 (°)</span><input id="pAng" type="number" value="`+M.trav.minAng+`"></div><div class="param"><span>导线全长上限 (m)</span><input id="pTot" type="number" value="`+M.trav.totLen+`"></div>`;
    document.getElementById(`pRatio`).onchange=e=>{M.trav.maxRatio=+e.target.value||3;refresh();};
    document.getElementById(`pAng`).onchange=e=>{M.trav.minAng=+e.target.value||30;refresh();};
    document.getElementById(`pTot`).onchange=e=>{M.trav.totLen=+e.target.value||4000;refresh();};
  }else{
    box.innerHTML=`<div class="param"><span>视线长度上限 (m)</span><input id="pSight" type="number" value="`+M.lev.maxSight+`"></div>`;
    document.getElementById(`pSight`).onchange=e=>{M.lev.maxSight=+e.target.value||50;refresh();};
  }
}
function subActive(id){[`subPoint`,`subEdge`,`subTri`].forEach(x=>{const el=document.getElementById(x);if(el)el.classList.toggle(`active`,x===id);});}
document.querySelectorAll(`.tab`).forEach(tab=>{tab.onclick=()=>{cur=tab.dataset.m;setTabUI();M.gnss.sel=null;M.gnss.triSel=[];calc.set=[];selectedPtIds.clear();buildParams();refresh();};});

/* ===== 累加器 ===== */
document.getElementById(`calcToggle`).onclick=()=>{calc.on=!calc.on;if(!calc.on)calc.set=[];refresh();toast(calc.on?`累加器已开启：点击边累加`:`累加器已关闭`);};
document.getElementById(`calcClear`).onclick=()=>{calc.set=[];refresh();};
document.getElementById(`noteToggle`).onclick=()=>{noteMode=!noteMode;const btn=document.getElementById(`noteToggle`);btn.classList.toggle(`active`,noteMode);btn.textContent=noteMode?`停止添加`:`添加图记`;if(noteMode)toast(`图记模式：点击地图放置标注`);};
document.getElementById(`noteClear`).onclick=async()=>{if(!M.notes.length){toast(`没有图记`);return;}const r=await showConfirm(`清空图记`,`<p>确定删除全部 `+M.notes.length+` 个图记？</p>`,[{text:`取消`,value:`cancel`},{text:`清空`,value:`del`,cls:`go`}]);if(!r||r.action!==`del`)return;pushUndo();M.notes.forEach(n=>map.removeLayer(n.marker));M.notes=[];toast(`已清空全部图记`);};

/* ===== 导出/复制 ===== */
function download(fn,text,mime){const blob=new Blob([text],{type:mime||`text/plain;charset=utf-8`});const url=URL.createObjectURL(blob);const a=document.createElement(`a`);a.href=url;a.download=fn;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
function modeRows(){const pts=m().pts;const rows=[[`点名`,`类型`,`纬度B`,`经度L`]];pts.forEach((p,i)=>rows.push([label(cur,i),p.link?`同步`:(p.kind===`known`?`已知`:`待测`),p.wgs.lat.toFixed(8),p.wgs.lng.toFixed(8)]));return rows;}
document.getElementById(`copyBtn`).onclick=()=>{const pts=m().pts;if(!pts.length){toast(`当前模式没有点位`);return;}const txt=modeRows().map(r=>r.join(`\t`)).join(`\n`);if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(()=>toast(`已复制 `+pts.length+` 点`)).catch(()=>fallbackCopy(txt));else fallbackCopy(txt);};
document.getElementById(`csvBtn`).onclick=()=>{const pts=m().pts;if(!pts.length){toast(`当前模式没有点位`);return;}const csv=`﻿`+modeRows().map(r=>r.map(c=>/[",\n]/.test(c)?`"`+c.replace(/"/g,`""`)+`"`:c).join(`,`)).join(`\r\n`);download(`控制点_`+{gnss:`GNSS`,trav:`导线`,lev:`水准`}[cur]+`.csv`,csv,`text/csv;charset=utf-8`);toast(`已导出 CSV`);};
function fallbackCopy(txt){const ta=document.createElement(`textarea`);ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand(`copy`);toast(`已复制`);}catch(e){toast(`复制失败`);}document.body.removeChild(ta);}
document.getElementById(`clearModeBtn`).onclick=()=>{pushUndo();if(cur===`trav`||cur===`lev`){M[cur].routes.forEach(r=>{r.pts.forEach(p=>map.removeLayer(p.marker));});M[cur].impGhosts.forEach(g=>map.removeLayer(g.marker));M[cur].impGhosts=[];M[cur].routes=[];M[cur].activeRouteId=null;}else{m().pts.forEach(p=>map.removeLayer(p.marker));m().pts=[];m().impGhosts.forEach(g=>map.removeLayer(g.marker));m().impGhosts=[];if(cur===`gnss`){M.gnss.edges=[];M.gnss.triangles=[];M.gnss.sel=null;M.gnss.triSel=[];}}selectedPtIds.clear();refresh();toast(`已清空当前模式`);};
function updateDatumNote(){document.getElementById(`datumNote`).textContent=currentBase===`sat`?`高德卫星底图(GCJ-02)已自动换算为真实 WGS-84 显示/导出；距离按 WGS-84 椭球 Vincenty 计算。`:`OSM 街道底图为 WGS-84，无偏移。`;}

/* ===== 方案管理 ===== */
const LSKEY=`cs_schemes_v1`;let schemes={},lsOK=true;
function loadSchemes(){try{schemes=JSON.parse(localStorage.getItem(LSKEY)||`{}`)||{};}catch(e){schemes={};lsOK=false;}}
function persistSchemes(){try{localStorage.setItem(LSKEY,JSON.stringify(schemes));return true;}catch(e){lsOK=false;return false;}}
function renderSchemes(){const box=document.getElementById(`schemeList`);const names=Object.keys(schemes);if(!names.length){box.innerHTML=`<div class="note" style="margin-top:0">暂无保存的方案。`+(lsOK?``:`（浏览器本地存储不可用，请用"导出方案文件"备份）`)+`</div>`;return;}box.innerHTML=``;names.sort((a,b)=>schemes[b].ts-schemes[a].ts).forEach(n=>{const row=document.createElement(`div`);row.className=`scheme-row`;const d=new Date(schemes[n].ts);row.innerHTML=`<span class="nm" title="`+n+`">`+n+`</span><span class="tm">`+(d.getMonth()+1)+`/`+d.getDate()+` `+String(d.getHours()).padStart(2,`0`)+`:`+String(d.getMinutes()).padStart(2,`0`)+`</span>`;const lb=document.createElement(`button`);lb.className=`ic`;lb.textContent=`读取`;lb.onclick=()=>{pushUndo();restore(schemes[n].data);toast(`已读取方案「`+n+`」`);};const db=document.createElement(`button`);db.className=`ic del`;db.textContent=`删`;db.onclick=()=>{delete schemes[n];persistSchemes();renderSchemes();};row.appendChild(lb);row.appendChild(db);box.appendChild(row);});}
document.getElementById(`schemeSave`).onclick=()=>{const inp=document.getElementById(`schemeName`);const n=inp.value.trim();if(!n){toast(`请先输入方案名`);return;}schemes[n]={data:serialize(),ts:Date.now()};const ok=persistSchemes();inp.value=``;renderSchemes();toast(ok?`已保存方案「`+n+`」`:`已保存(本会话)，浏览器存储不可用，建议导出文件`);};
document.getElementById(`schemeExport`).onclick=()=>{download(`控制网方案_`+new Date().toISOString().slice(0,10)+`.json`,JSON.stringify(serialize(),null,1),`application/json`);toast(`已导出方案文件`);};
document.getElementById(`schemeImport`).onclick=()=>document.getElementById(`schemeFile`).click();
document.getElementById(`schemeFile`).onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const txt=await f.text();const sp=JSON.parse(txt);pushUndo();restore(sp);toast(`已导入方案文件`);}catch(err){toast(`方案文件解析失败`);}e.target.value=``;};

/* ===== 帮助说明（文本在 help-text.js） ===== */
const helpPop=document.getElementById(`helpPop`);
function showHelp(key,anchor){const d=HELP[key];if(!d)return;const body=Array.isArray(d.body)?d.body.map(s=>`<p>`+s+`</p>`).join(``):d.body||``;helpPop.innerHTML=`<span class="close">×</span><h4>`+d.title+`</h4>`+body;helpPop.style.display=`block`;const r=anchor.getBoundingClientRect(),pw=helpPop.offsetWidth,ph=helpPop.offsetHeight;let left=r.right-pw;left=Math.max(8,Math.min(left,window.innerWidth-8-pw));let top=r.bottom+6;if(top+ph>window.innerHeight-8)top=r.top-ph-6;if(top<8)top=8;helpPop.style.left=left+`px`;helpPop.style.top=top+`px`;helpPop.classList.add(`show`);}
function hideHelp(){helpPop.style.display=`none`;helpPop.classList.remove(`show`);helpPop._k=null;}
document.addEventListener(`click`,e=>{const dot=e.target.closest(`.help-dot`);if(dot){e.stopPropagation();if(helpPop.classList.contains(`show`)&&helpPop._k===dot.dataset.help){hideHelp();return;}helpPop._k=dot.dataset.help;showHelp(dot.dataset.help,dot);return;}if(e.target.closest(`#helpPop`)){if(e.target.classList.contains(`close`))hideHelp();return;}hideHelp();});
document.querySelectorAll('.panel-body,.float-popup').forEach(el=>el.addEventListener('scroll',hideHelp));
window.addEventListener(`resize`,hideHelp);

/* ===== 初始化 ===== */
loadSchemes();renderSchemes();buildParams();refresh();updateDatumNote();updateUndoButtons();
updatePanels();
map.setView(displayLL(XIASHU),14);
(function(){const c=trueLL(map.getCenter());lastSavedMapView={lat:c.lat,lng:c.lng,zoom:map.getZoom()};})();
const introEl=document.getElementById(`intro`);
document.getElementById(`introClose`).onclick=()=>introEl.classList.remove(`show`);
introEl.onclick=e=>{if(e.target===introEl)introEl.classList.remove(`show`);};
