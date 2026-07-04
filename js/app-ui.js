/* ===== 面板管理 ===== */
function togglePanel(name){
  panels[name]=!panels[name];
  if(isMobileLayout()&&(name===`design`||name===`analysis`)&&panels[name]){
    panels[name===`design`?`analysis`:`design`]=false;
    if(floatOpen){floatOpen=null;document.querySelectorAll(`.float-popup`).forEach(p=>p.classList.remove(`open`));}
  }
  updatePanels();
}
function updatePanels(){
  const names=['design','points','analysis'],openNames=names.filter(n=>panels[n]),cnt=openNames.length;
  const panelArea=document.getElementById('panelArea');
  if(isMobileLayout()){
    panelArea.classList.toggle('open',cnt>0);
    panelArea.classList.toggle('points-open',!!panels.points);
    if(!panels.points)panelArea.style.height='';
    else if(mobilePointsPanelHeight)panelArea.style.height=mobilePointsPanelHeight+'px';
    names.forEach(n=>{const el=document.getElementById('panel'+n.charAt(0).toUpperCase()+n.slice(1));el.classList.toggle('open',panels[n]);el.style.flex='';});
    document.getElementById('resizerDp').style.display='none';
    document.getElementById('resizerPa').style.display='none';
  }else{
    panelArea.classList.toggle('open',cnt>0);
    panelArea.classList.remove('points-open');
    panelArea.style.height='';
    names.forEach(n=>{const el=document.getElementById('panel'+n.charAt(0).toUpperCase()+n.slice(1));el.classList.toggle('open',panels[n]);if(!panels[n])el.style.flex='';else if(n==='design')el.style.flex='0 0 auto';else el.style.flex=cnt===1?'0 0 auto':'1';});
    document.getElementById('resizerDp').style.display=(panels.design&&(panels.points||panels.analysis))?'block':'none';
    document.getElementById('resizerPa').style.display=(panels.points&&panels.analysis)?'block':'none';
  }
  document.querySelectorAll('.icon-tab').forEach(t=>t.classList.toggle('active',panels[t.dataset.panel]));
  document.querySelectorAll('.mobile-panel-fab').forEach(t=>t.classList.toggle('active',panels[t.dataset.panel]));
  setTimeout(()=>map.invalidateSize(),50);
}
document.querySelectorAll('.icon-tab').forEach(t=>{t.onclick=()=>togglePanel(t.dataset.panel);});
document.querySelectorAll('.mobile-panel-fab').forEach(t=>{t.onclick=()=>togglePanel(t.dataset.panel);});
document.querySelectorAll('.panel-close').forEach(b=>{b.onclick=()=>togglePanel(b.dataset.panel);});

/* ===== 浮动面板 ===== */
function toggleFloat(name){floatOpen=floatOpen===name?null:name;if(isMobileLayout()&&floatOpen){panels.design=false;panels.analysis=false;updatePanels();}document.getElementById('schemeFloat').classList.toggle('open',floatOpen==='scheme');document.getElementById('toolsFloat').classList.toggle('open',floatOpen==='tools');}
document.querySelectorAll('.float-close').forEach(b=>{b.onclick=()=>{floatOpen=null;document.querySelectorAll('.float-popup').forEach(p=>p.classList.remove('open'));hideHelp();};});
document.addEventListener(`mousedown`,e=>{
  let _dismissed=false;
  if(floatOpen&&!e.target.closest(`#${floatOpen}Float,#fabContainer`)){floatOpen=null;document.querySelectorAll(`.float-popup`).forEach(p=>p.classList.remove(`open`));hideHelp();_dismissed=true;}
  if(typeof helpPop!==`undefined`&&helpPop&&helpPop.classList.contains(`show`)&&!e.target.closest(`#helpPop,.help-dot`)){hideHelp();_dismissed=true;}
  if(!e.target.closest(`.leaflet-popup,.leaflet-marker-icon,.leaflet-div-icon`)){if(map&&map._popup&&map.hasLayer(map._popup)){_dismissed=true;map.closePopup();}}
  if(_dismissed){_popupJustClosed=true;setTimeout(()=>{_popupJustClosed=false;},350);}
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

let mobilePointsPanelHeight=null;
function bindMobilePanelResizer(){
  const bar=document.getElementById('mobilePanelResizer');
  const panelArea=document.getElementById('panelArea');
  if(!bar||!panelArea)return;
  let dragging=false,startY=0,startH=0;
  const clamp=h=>{
    const max=Math.max(160,window.innerHeight*0.72);
    const min=Math.max(120,window.innerHeight*0.22);
    return Math.max(min,Math.min(max,h));
  };
  bar.addEventListener('pointerdown',e=>{
    if(!isMobileLayout()||!panels.points)return;
    e.preventDefault();
    dragging=true;startY=e.clientY;startH=panelArea.getBoundingClientRect().height;
    bar.setPointerCapture&&bar.setPointerCapture(e.pointerId);
    document.body.style.userSelect='none';
  });
  bar.addEventListener('pointermove',e=>{
    if(!dragging)return;
    mobilePointsPanelHeight=clamp(startH-(e.clientY-startY));
    panelArea.style.height=mobilePointsPanelHeight+'px';
    setTimeout(()=>map.invalidateSize(),0);
  });
  function end(e){
    if(!dragging)return;
    dragging=false;
    if(e&&bar.releasePointerCapture)try{bar.releasePointerCapture(e.pointerId);}catch(err){}
    document.body.style.userSelect='';
    map.invalidateSize();
  }
  bar.addEventListener('pointerup',end);
  bar.addEventListener('pointercancel',end);
}
bindMobilePanelResizer();

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
function switchMode(mode){
  if(!M[mode]||cur===mode)return;
  if(typeof ctrlObjectCancel===`function`)ctrlObjectCancel();
  cur=mode;setTabUI();M.gnss.sel=null;M.gnss.triSel=[];calc.set=[];selectedPtIds.clear();buildParams();refresh();
}
function buildParams(){
  const box=document.getElementById(`paramBox`);
  document.getElementById(`modeTitleText`).textContent={gnss:`GNSS 控制网 · 三角网`,trav:`导线 · 附合/闭合`,lev:`水准路线 · 二等往返`}[cur];
  if(cur===`gnss`){
    box.innerHTML=`<div class="param"><span>最短基线限值 (m)</span><input id="pMinEdge" type="number" value="`+M.gnss.minEdge+`"></div>`;
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
document.querySelectorAll(`.tab`).forEach(tab=>{tab.onclick=()=>switchMode(tab.dataset.m);});

/* ===== 累加器 ===== */
document.getElementById(`calcToggle`).onclick=()=>{calc.on=!calc.on;if(!calc.on)calc.set=[];refresh();toast(calc.on?`累加器已开启：点击边累加`:`累加器已关闭`);};
document.getElementById(`calcClear`).onclick=()=>{calc.set=[];refresh();};
document.getElementById(`noteToggle`).onclick=()=>{noteMode=!noteMode;const btn=document.getElementById(`noteToggle`);btn.classList.toggle(`active`,noteMode);btn.textContent=noteMode?`停止添加`:`添加图记`;if(noteMode)toast(`图记模式：点击地图放置标注`);};
document.getElementById(`noteClear`).onclick=async()=>{if(!M.notes.length){toast(`没有图记`);return;}const r=await showConfirm(`清空图记`,`<p>确定删除全部 `+M.notes.length+` 个图记？</p>`,[{text:`取消`,value:`cancel`},{text:`清空`,value:`del`,cls:`go`}]);if(!r||r.action!==`del`)return;pushUndo();M.notes.forEach(n=>map.removeLayer(n.marker));M.notes=[];refresh();toast(`已清空全部图记`);};
let noteListExpanded=false;
function renderNoteList(){
  const box=document.getElementById(`noteList`);
  if(!box)return;
  box.innerHTML=``;
  const toggle=document.createElement(`div`);
  toggle.className=`note-toggle`;
  const arrow=document.createElement(`span`);
  arrow.textContent=noteListExpanded?`▼`:`▶`;
  arrow.className=`note-toggle-arrow`;
  toggle.appendChild(arrow);
  const info=document.createElement(`span`);
  info.textContent=M.notes.length+` 个图记`;
  toggle.appendChild(info);
  toggle.onclick=e=>{e.stopPropagation();noteListExpanded=!noteListExpanded;renderNoteList();};
  box.appendChild(toggle);
  if(!noteListExpanded)return;
  if(!M.notes.length){const empty=document.createElement(`div`);empty.className=`note-list-empty`;empty.textContent=`暂无图记。`;box.appendChild(empty);return;}
  M.notes.forEach((n,i)=>{
    const row=document.createElement(`div`);
    row.className=`note-row`+(n.dim?` dim`:``);
    const no=document.createElement(`span`);
    no.className=`note-no`;
    no.textContent=`#`+(i+1);
    row.appendChild(no);
    const inp=document.createElement(`input`);
    inp.type=`text`;
    inp.value=n.text||``;
    inp.placeholder=`备注文字`;
    inp.onkeydown=e=>{if(e.key===`Enter`){e.preventDefault();inp.blur();}};
    inp.onchange=()=>{const v=inp.value.trim();if(v===(n.text||``))return;pushUndo();n.text=v;n.marker.setIcon(noteIcon(n));refresh();};
    row.appendChild(inp);
    const dim=document.createElement(`button`);
    dim.className=`ic`+(n.dim?` active`:``);
    dim.textContent=`虚`;
    dim.title=n.dim?`恢复图记`:`虚化图记`;
    dim.onclick=()=>{pushUndo();n.dim=!n.dim;refresh();toast(n.dim?`图记已虚化`:`图记已恢复`);};
    row.appendChild(dim);
    const zoom=document.createElement(`button`);
    zoom.className=`ic`;
    zoom.title=`缩放到图记`;
    zoom.innerHTML=`<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 5V1h4"/><path d="M11 1h4v4"/><path d="M15 11v4h-4"/><path d="M5 15H1v-4"/></svg>`;
    zoom.onclick=()=>map.setView(displayLL(n.wgs),map.getZoom(),{animate:false});
    row.appendChild(zoom);
    box.appendChild(row);
  });
}

/* ===== 导出/复制 ===== */
function download(fn,text,mime){const blob=new Blob([text],{type:mime||`text/plain;charset=utf-8`});const url=URL.createObjectURL(blob);const a=document.createElement(`a`);a.href=url;a.download=fn;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);}
function modeRows(){const pts=m().pts;const rows=[[`点名`,`类型`,`纬度B`,`经度L`]];pts.forEach((p,i)=>rows.push([label(cur,i),p.link?`同步`:(p.kind===`known`?`已知`:`待测`),p.wgs.lat.toFixed(8),p.wgs.lng.toFixed(8)]));return rows;}
document.getElementById(`copyBtn`).onclick=()=>{const pts=m().pts;if(!pts.length){toast(`当前模式没有点位`);return;}const txt=modeRows().map(r=>r.join(`\t`)).join(`\n`);if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(()=>toast(`已复制 `+pts.length+` 点`)).catch(()=>fallbackCopy(txt));else fallbackCopy(txt);};
document.getElementById(`csvBtn`).onclick=()=>{const pts=m().pts;if(!pts.length){toast(`当前模式没有点位`);return;}const csv=`﻿`+modeRows().map(r=>r.map(c=>/[",\n]/.test(c)?`"`+c.replace(/"/g,`""`)+`"`:c).join(`,`)).join(`\r\n`);download(`控制点_`+{gnss:`GNSS`,trav:`导线`,lev:`水准`}[cur]+`.csv`,csv,`text/csv;charset=utf-8`);toast(`已导出 CSV`);};
function fallbackCopy(txt){const ta=document.createElement(`textarea`);ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand(`copy`);toast(`已复制`);}catch(e){toast(`复制失败`);}document.body.removeChild(ta);}
document.getElementById(`clearModeBtn`).onclick=()=>{pushUndo();if(cur===`trav`||cur===`lev`){M[cur].routes.forEach(r=>{r.pts.forEach(p=>map.removeLayer(p.marker));});M[cur].impGhosts.forEach(g=>map.removeLayer(g.marker));M[cur].impGhosts=[];M[cur].routes=[];M[cur].activeRouteId=null;}else{m().pts.forEach(p=>map.removeLayer(p.marker));m().pts=[];m().impGhosts.forEach(g=>map.removeLayer(g.marker));m().impGhosts=[];if(cur===`gnss`){M.gnss.edges=[];M.gnss.triangles=[];M.gnss.sel=null;M.gnss.triSel=[];}}selectedPtIds.clear();refresh();toast(`已清空当前模式`);};
function updateDatumNote(){document.getElementById(`datumNote`).textContent=currentBase===`sat`?`高德卫星底图(GCJ-02)已自动换算为真实 WGS-84 显示/导出；距离按 WGS-84 椭球 Vincenty 计算。`:`OSM 街道底图为 WGS-84，无偏移。`;}

/* ===== 键盘快捷键 ===== */
function isTextEditing(){
  const el=document.activeElement;
  if(!el)return false;
  const tag=el.tagName;
  return tag===`INPUT`||tag===`TEXTAREA`||tag===`SELECT`||el.isContentEditable;
}
function currentSelectablePts(){
  if(cur===`gnss`)return M.gnss.pts;
  const route=activeRouteOf(cur);
  return route?route.pts.filter(p=>p.kind!==`turn`):[];
}
function selectedRefs(){
  if(cur===`gnss`)return M.gnss.pts.filter(p=>selectedPtIds.has(p.id)).map(p=>({p,route:null}));
  const refs=[];
  M[cur].routes.forEach(route=>route.pts.forEach(p=>{if(selectedPtIds.has(p.id))refs.push({p,route});}));
  return refs;
}
function canDeleteRef(ref){
  if(cur===`gnss`)return true;
  if(!ref.route||ref.route.locked)return false;
  return !(cur===`lev`&&ref.route.linkedRouteId&&ref.p.link);
}
function deleteRef(ref){
  const p=ref.p;
  map.removeLayer(p.marker);
  if(cur===`gnss`){
    M.gnss.pts=M.gnss.pts.filter(x=>x!==p);
    M.gnss.edges=M.gnss.edges.filter(e=>e.a!==p&&e.b!==p);
    M.gnss.triangles=M.gnss.triangles.filter(t=>!t.pts.includes(p));
    if(M.gnss.sel===p)M.gnss.sel=null;
    M.gnss.triSel=M.gnss.triSel.filter(x=>x!==p);
    return;
  }
  ref.route.pts=ref.route.pts.filter(x=>x!==p);
  if(p.fromImpGhost&&!p.link){
    const g={id:++uid,name:p.name,wgs:{lat:p.wgs.lat,lng:p.wgs.lng}};
    g.marker=makeImpGhostMarker(cur,g);
    M[cur].impGhosts.push(g);
  }
}
function deleteSelectedPts(){
  const refs=selectedRefs();
  if(!refs.length){toast(`没有选中的点`);return;}
  const deletable=refs.filter(canDeleteRef);
  if(!deletable.length){toast(`选中的点不可删除`);return;}
  pushUndo();
  deletable.forEach(deleteRef);
  const skipped=refs.length-deletable.length;
  selectedPtIds.clear();refresh();
  toast(skipped?`已删除 `+deletable.length+` 个点，跳过 `+skipped+` 个不可删除点`:`已删除 `+deletable.length+` 个点`);
}
function selectAllCurrentPts(){
  const pts=currentSelectablePts();
  if(!pts.length){toast(`当前路线没有可选点`);return;}
  pts.forEach(p=>selectedPtIds.add(p.id));
  updateSelUI();toast(`已全选 `+pts.length+` 个点`);
}
function closeTransientUI(){
  if(helpPop&&helpPop.classList.contains(`show`)){hideHelp();return;}
  if(map&&map._popup&&map.hasLayer(map._popup)){map.closePopup();return;}
  if(typeof ctxMenu!==`undefined`&&ctxMenu&&ctxMenu.style.display===`block`){hideCtx();return;}
  if(noteMode){
    noteMode=false;
    const btn=document.getElementById(`noteToggle`);
    btn.classList.remove(`active`);
    btn.textContent=`添加图记`;
    toast(`图记模式已关闭`);
    return;
  }
  if(floatOpen){
    const name=floatOpen;
    floatOpen=null;
    document.querySelectorAll(`.float-popup`).forEach(p=>p.classList.remove(`open`));
    if(name===`scheme`)hideHelp();
    return;
  }
  if(M.gnss.sel||M.gnss.triSel.length){
    M.gnss.sel=null;M.gnss.triSel=[];refreshIcons(`gnss`);
    return;
  }
}
document.addEventListener(`keydown`,e=>{
  const k=e.key.toLowerCase();
  if(isTextEditing())return;
  if(e.key===`Control`){if(typeof ctrlObjectBegin===`function`)ctrlObjectBegin();return;}
  if(k===`1`||k===`2`||k===`3`){e.preventDefault();switchMode({1:`gnss`,2:`trav`,3:`lev`}[k]);return;}
  if(e.key===`Delete`){e.preventDefault();deleteSelectedPts();return;}
  if(e.key===`Escape`){e.preventDefault();closeTransientUI();return;}
  if((e.ctrlKey||e.metaKey)&&k===`a`){e.preventDefault();if(typeof ctrlObj!==`undefined`)ctrlObj.suppress=true;selectAllCurrentPts();return;}
  if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&k===`f`){e.preventDefault();zoomToFit();}
});
document.addEventListener(`keyup`,e=>{if(e.key===`Control`&&typeof ctrlObjectCommit===`function`)ctrlObjectCommit();});
function releaseCtrlObject(){if(typeof ctrlObjectCancel===`function`)ctrlObjectCancel();}
window.addEventListener(`blur`,releaseCtrlObject);
document.addEventListener(`visibilitychange`,()=>{if(document.hidden)releaseCtrlObject();});
function bindMobileCtrlSwitch(){
  const sw=document.getElementById(`mobileCtrlSwitch`);
  if(!sw)return;
  sw.onchange=()=>{
    if(sw.checked){
      if(typeof ctrlObjectBegin===`function`)ctrlObjectBegin();
    }else if(typeof ctrlObjectCommit===`function`){
      ctrlObjectCommit();
    }
  };
}
bindMobileCtrlSwitch();

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
function helpBodyOf(d){const body=isMobileLayout()&&d.mobileBody?d.mobileBody:d.body;return Array.isArray(body)?body.map(s=>`<p>`+s+`</p>`).join(``):body||``;}
function showHelp(key,anchor){const d=HELP[key];if(!d)return;const body=helpBodyOf(d);helpPop.innerHTML=`<span class="close">×</span><h4>`+d.title+`</h4>`+body;helpPop.style.display=`block`;const r=anchor.getBoundingClientRect(),pw=helpPop.offsetWidth,ph=helpPop.offsetHeight;let left=r.right-pw;left=Math.max(8,Math.min(left,window.innerWidth-8-pw));let top=r.bottom+6;if(top+ph>window.innerHeight-8)top=r.top-ph-6;if(top<8)top=8;helpPop.style.left=left+`px`;helpPop.style.top=top+`px`;helpPop.classList.add(`show`);}
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
