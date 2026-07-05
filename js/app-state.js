/* ===== 状态 ===== */
const SVG_OK='<svg class="mk-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="7" r="5.5" stroke-width="1.2" opacity=".35"/><path d="M4.5 7l1.8 2 3.2-3.5" stroke-width="1.6"/></svg>';
const SVG_FAIL='<svg class="mk-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-linecap="round"><circle cx="7" cy="7" r="5.5" stroke-width="1.2" opacity=".35"/><path d="M5 5l4 4M9 5l-4 4" stroke-width="1.6"/></svg>';
const SVG_WARN_ICON='<svg class="mk-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1.5L13 12.5H1Z" stroke-width="1.2"/><line x1="7" y1="5.5" x2="7" y2="8.5" stroke-width="1.5"/><circle cx="7" cy="10.5" r=".5" fill="currentColor" stroke="none"/></svg>';
let uid=0;
let _popupJustClosed=false;
const M={
  gnss:{pts:[],edges:[],triangles:[],lines:[],triLayers:[],prefix:`A`,cls:`gnss`,sub:`point`,sel:null,triSel:[],minEdge:500,impGhosts:[]},
  trav:{routes:[],activeRouteId:null,ghosts:[],lines:[],prefix:`K`,cls:`trav`,maxRatio:3,minAng:30,totLen:4000,impGhosts:[]},
  lev:{routes:[],activeRouteId:null,lines:[],prefix:`S`,cls:`lev`,maxSight:50,impGhosts:[]},
  notes:[],
};

/* ===== 路线通用操作（导线 / 水准共用） ===== */
const ROUTE_LABEL={trav:`导线`,lev:`水准路线`};
function activeRouteOf(mode){return M[mode].routes.find(r=>r.id===M[mode].activeRouteId)||null;}
function allRoutePts(mode){return M[mode].routes.flatMap(r=>r.pts);}
function pointRefs(){
  const refs=[];
  M.gnss.pts.forEach((p,i)=>refs.push({mode:`gnss`,route:null,p,i}));
  [`trav`,`lev`].forEach(mode=>M[mode].routes.forEach(route=>route.pts.forEach((p,i)=>refs.push({mode,route,p,i}))));
  return refs;
}
function routePrefixOf(mode,route){return route&&route.prefix?route.prefix:M[mode].prefix;}
function displayNameOfRef(ref){return ref.p.name||routePrefixOf(ref.mode,ref.route)+String(ref.i+1).padStart(2,`0`);}
function pointSamePlace(a,b){return !!(a&&b&&Math.abs(a.wgs.lat-b.wgs.lat)<1e-10&&Math.abs(a.wgs.lng-b.wgs.lng)<1e-10);}
function pointNameConflict(name,self,ignore){
  const nm=(name||``).trim();
  if(!nm)return null;
  return pointRefs().find(ref=>ref.p!==self&&!(ignore&&ignore.has(ref.p))&&displayNameOfRef(ref)===nm&&!pointSamePlace(ref.p,self))||null;
}
function usedPrefixes(){
  const used=new Set([M.gnss.prefix,M.trav.prefix,M.lev.prefix].filter(Boolean).map(x=>String(x).toUpperCase()));
  [`trav`,`lev`].forEach(mode=>M[mode].routes.forEach(r=>{if(r.prefix)used.add(String(r.prefix).toUpperCase());}));
  pointRefs().forEach(ref=>{const nm=displayNameOfRef(ref);const m=String(nm||``).match(/^[A-Za-z]+/);if(m)used.add(m[0].toUpperCase());});
  return used;
}
function nextUnusedPrefix(){
  const used=usedPrefixes();
  for(let c=65;c<=90;c++){const p=String.fromCharCode(c);if(!used.has(p))return p;}
  let n=1;while(used.has(`P`+n))n++;
  return `P`+n;
}
function createRouteOf(mode,name,prefix,parentId){const r={id:++uid,name,prefix:prefix||nextUnusedPrefix(),pts:[],closed:false,hidden:false,locked:false,expanded:true,parentId:parentId||null};M[mode].routes.push(r);M[mode].activeRouteId=r.id;return r;}
function deleteRouteOf(mode,rid){const r=M[mode].routes.find(x=>x.id===rid);if(!r)return;r.pts.forEach(p=>map.removeLayer(p.marker));const kids=M[mode].routes.filter(x=>x.parentId===rid);kids.forEach(c=>c.pts.forEach(p=>map.removeLayer(p.marker)));M[mode].routes=M[mode].routes.filter(x=>x.id!==rid&&x.parentId!==rid);if(M[mode].activeRouteId===rid||kids.some(c=>c.id===M[mode].activeRouteId))M[mode].activeRouteId=M[mode].routes.length?M[mode].routes[0].id:null;}
function setActiveRouteIdOf(mode,rid){M[mode].activeRouteId=rid;selectedPtIds.clear();}
[`trav`,`lev`].forEach(mode=>{Object.defineProperty(M[mode],`pts`,{get(){const r=activeRouteOf(mode);return r?r.pts:[];},set(v){const r=activeRouteOf(mode);if(r)r.pts=v;},configurable:true,enumerable:false});});
function activeRoute(){return activeRouteOf(`trav`);}
function activeLevRoute(){return activeRouteOf(`lev`);}
function allTravPts(){return allRoutePts(`trav`);}
function allLevPts(){return allRoutePts(`lev`);}

let cur=`gnss`;
let selectedPtIds=new Set();
const calc={on:false,set:[]};
const CIRC=`①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳`;
function circ(n){return n<=20?CIRC[n-1]:`(${n})`;}
const m=()=>M[cur];
const panels={design:false,points:false,analysis:false};let floatOpen=null;
function label(mode,i){const p=M[mode].pts[i];if(p&&p.name)return p.name;let pfx=M[mode].prefix;if(mode===`trav`||mode===`lev`){const r=activeRouteOf(mode);if(r&&r.prefix)pfx=r.prefix;}return pfx+String(i+1).padStart(2,`0`);}
function pointById(mode,id){return M[mode].pts.find(p=>p.id===id);}
function keyOf(a,b){return a<b?a+`-`+b:b+`-`+a;}
function toast(t){const el=document.getElementById(`toast`);el.textContent=t;el.classList.add(`show`);clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove(`show`),2200);}

/* ===== 通用确认弹窗 ===== */
function showConfirm(title,bodyHTML,buttons){return new Promise(resolve=>{const ov=document.createElement(`div`);ov.style.cssText=`position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:9100;`;const md=document.createElement(`div`);md.className=`modal`;md.innerHTML=`<h3>`+title+`</h3><div>`+bodyHTML+`</div><div class="modal-actions"></div>`;const acts=md.querySelector(`.modal-actions`);buttons.forEach(btn=>{const b=document.createElement(`button`);b.textContent=btn.text;if(btn.cls)b.className=btn.cls;b.onclick=()=>{const inputs={};md.querySelectorAll(`input[data-key]`).forEach(inp=>{inputs[inp.dataset.key]=inp.value;});ov.remove();resolve({action:btn.value,inputs});};acts.appendChild(b);});ov.appendChild(md);ov.onclick=e=>{if(e.target===ov){ov.remove();resolve(null);}};document.body.appendChild(ov);const firstInput=md.querySelector(`input[data-key]`);if(firstInput){firstInput.focus();firstInput.select();}});}

/* ===== 撤销/重做 ===== */
let undoStack=[],redoStack=[],lastSavedMapView=null;
function serialize(){
  const sp={uid,cur,params:{gnss:{minEdge:M.gnss.minEdge},trav:{maxRatio:M.trav.maxRatio,minAng:M.trav.minAng,totLen:M.trav.totLen},lev:{maxSight:M.lev.maxSight}},modes:{}};
  const serPt=p=>({id:p.id,kind:p.kind,name:p.name,wgs:{lat:p.wgs.lat,lng:p.wgs.lng},sync:!!p.sync,link:p.link||null,indepName:!!p.indepName,fromImpGhost:!!p.fromImpGhost,knownEdgeAfter:!!p.knownEdgeAfter});
  const serGh=g=>({id:g.id,name:g.name,wgs:{lat:g.wgs.lat,lng:g.wgs.lng}});
  sp.modes.gnss={points:M.gnss.pts.map(serPt),impGhosts:M.gnss.impGhosts.map(serGh)};
  sp.modes.lev={routes:M.lev.routes.map(r=>({id:r.id,name:r.name,prefix:r.prefix||``,closed:!!r.closed,hidden:!!r.hidden,locked:!!r.locked,expanded:!!r.expanded,parentId:r.parentId||null,linkedRouteId:r.linkedRouteId||null,points:r.pts.map(serPt)})),activeRouteId:M.lev.activeRouteId,impGhosts:M.lev.impGhosts.map(serGh)};
  sp.modes.trav={routes:M.trav.routes.map(r=>({id:r.id,name:r.name,prefix:r.prefix||``,closed:!!r.closed,hidden:!!r.hidden,locked:!!r.locked,expanded:!!r.expanded,parentId:r.parentId||null,points:r.pts.map(serPt)})),activeRouteId:M.trav.activeRouteId,impGhosts:M.trav.impGhosts.map(serGh)};
  sp.modes.gnss.edges=M.gnss.edges.map(e=>[e.a.id,e.b.id]);
  sp.modes.gnss.triangles=M.gnss.triangles.map(t=>({pts:t.pts.map(p=>p.id),note:t.note||``}));
  const mc=trueLL(map.getCenter());sp.mapView={lat:mc.lat,lng:mc.lng,zoom:map.getZoom()};
  sp.notes=M.notes.map(n=>({id:n.id,text:n.text||``,dim:!!n.dim,wgs:{lat:n.wgs.lat,lng:n.wgs.lng}}));
  sp.bookmarks=bookmarks.map(b=>({name:b.name,lat:b.lat,lng:b.lng,zoom:b.zoom}));
  return sp;
}
function clearAll(){
  M.gnss.pts.forEach(p=>map.removeLayer(p.marker));M.gnss.pts=[];M.gnss.impGhosts.forEach(g=>map.removeLayer(g.marker));M.gnss.impGhosts=[];clearLines(`gnss`);
  M.trav.routes.forEach(r=>{r.pts.forEach(p=>map.removeLayer(p.marker));});
  M.trav.impGhosts.forEach(g=>map.removeLayer(g.marker));M.trav.impGhosts=[];
  M.trav.routes=[];M.trav.activeRouteId=null;clearLines(`trav`);
  M.lev.routes.forEach(r=>{r.pts.forEach(p=>map.removeLayer(p.marker));});
  M.lev.impGhosts.forEach(g=>map.removeLayer(g.marker));M.lev.impGhosts=[];
  M.lev.routes=[];M.lev.activeRouteId=null;clearLines(`lev`);
  clearGhosts();clearTriLayers();M.gnss.edges=[];M.gnss.triangles=[];M.gnss.sel=null;M.gnss.triSel=[];calc.set=[];
  M.notes.forEach(n=>map.removeLayer(n.marker));M.notes=[];
}
function restore(sp){
  clearAll();
  M.gnss.minEdge=sp.params.gnss.minEdge;M.trav.maxRatio=sp.params.trav.maxRatio;M.trav.minAng=sp.params.trav.minAng;M.trav.totLen=sp.params.trav.totLen;M.lev.maxSight=sp.params.lev.maxSight;
  sp.modes.gnss.points.forEach(d=>{const p={id:d.id,kind:d.kind,name:d.name,wgs:{lat:d.wgs.lat,lng:d.wgs.lng},sync:!!d.sync,link:d.link||null,indepName:!!d.indepName,fromImpGhost:!!d.fromImpGhost,knownEdgeAfter:!!d.knownEdgeAfter};p.marker=L.marker(displayLL(p.wgs),{draggable:!p.link}).addTo(map);M.gnss.pts.push(p);bindMarker(`gnss`,p);});(sp.modes.gnss.impGhosts||[]).forEach(d=>{const g={id:d.id,name:d.name,wgs:{lat:d.wgs.lat,lng:d.wgs.lng}};g.marker=makeImpGhostMarker(`gnss`,g);M.gnss.impGhosts.push(g);});
  const td=sp.modes.trav;
  if(td.routes){
    td.routes.forEach(rd=>{
      const route={id:rd.id,name:rd.name,prefix:rd.prefix||``,closed:!!rd.closed,hidden:!!rd.hidden,locked:!!rd.locked,expanded:rd.expanded!==false,parentId:rd.parentId||null,pts:[]};
      M.trav.routes.push(route);M.trav.activeRouteId=route.id;
      rd.points.forEach(d=>{const p={id:d.id,kind:d.kind,name:d.name,wgs:{lat:d.wgs.lat,lng:d.wgs.lng},sync:!!d.sync,link:d.link||null,indepName:!!d.indepName,fromImpGhost:!!d.fromImpGhost,knownEdgeAfter:!!d.knownEdgeAfter};p.marker=L.marker(displayLL(p.wgs),{draggable:!p.link&&!route.locked}).addTo(map);route.pts.push(p);bindMarker(`trav`,p);});
    });
    M.trav.activeRouteId=td.activeRouteId||null;
    if(M.trav.activeRouteId&&!M.trav.routes.find(r=>r.id===M.trav.activeRouteId))M.trav.activeRouteId=M.trav.routes.length?M.trav.routes[0].id:null;
  }else if(td.points&&td.points.length){
    const route={id:++uid,name:`导线1`,prefix:``,closed:false,hidden:false,locked:false,expanded:true,parentId:null,pts:[]};
    M.trav.routes.push(route);M.trav.activeRouteId=route.id;
    td.points.forEach(d=>{const p={id:d.id,kind:d.kind,name:d.name,wgs:{lat:d.wgs.lat,lng:d.wgs.lng},sync:!!d.sync,link:d.link||null,indepName:!!d.indepName,fromImpGhost:!!d.fromImpGhost,knownEdgeAfter:!!d.knownEdgeAfter};p.marker=L.marker(displayLL(p.wgs),{draggable:!p.link}).addTo(map);route.pts.push(p);bindMarker(`trav`,p);});
  }
  const travGhData=td.impGhosts||td.routes&&td.routes.flatMap(r=>r.impGhosts||[])||[];
  travGhData.forEach(d=>{const g={id:d.id,name:d.name,wgs:{lat:d.wgs.lat,lng:d.wgs.lng}};g.marker=makeImpGhostMarker(`trav`,g);M.trav.impGhosts.push(g);});
  const ld=sp.modes.lev;
  if(ld.routes){
    ld.routes.forEach(rd=>{
      const route={id:rd.id,name:rd.name,prefix:rd.prefix||``,closed:!!rd.closed,hidden:!!rd.hidden,locked:!!rd.locked,expanded:rd.expanded!==false,parentId:rd.parentId||null,linkedRouteId:rd.linkedRouteId||null,pts:[]};
      M.lev.routes.push(route);M.lev.activeRouteId=route.id;
      rd.points.forEach(d=>{const p={id:d.id,kind:d.kind,name:d.name,wgs:{lat:d.wgs.lat,lng:d.wgs.lng},sync:!!d.sync,link:d.link||null,indepName:!!d.indepName,fromImpGhost:!!d.fromImpGhost,knownEdgeAfter:!!d.knownEdgeAfter};p.marker=L.marker(displayLL(p.wgs),{draggable:!p.link&&!route.locked}).addTo(map);route.pts.push(p);bindMarker(`lev`,p);});
    });
    M.lev.activeRouteId=ld.activeRouteId||null;
    if(M.lev.activeRouteId&&!M.lev.routes.find(r=>r.id===M.lev.activeRouteId))M.lev.activeRouteId=M.lev.routes.length?M.lev.routes[0].id:null;
  }else if(ld.points&&ld.points.length){
    const route={id:++uid,name:`水准1`,prefix:``,closed:false,hidden:false,locked:false,expanded:true,parentId:null,pts:[]};
    M.lev.routes.push(route);M.lev.activeRouteId=route.id;
    ld.points.forEach(d=>{const p={id:d.id,kind:d.kind,name:d.name,wgs:{lat:d.wgs.lat,lng:d.wgs.lng},sync:!!d.sync,link:d.link||null,indepName:!!d.indepName,fromImpGhost:!!d.fromImpGhost,knownEdgeAfter:!!d.knownEdgeAfter};p.marker=L.marker(displayLL(p.wgs),{draggable:true}).addTo(map);route.pts.push(p);bindMarker(`lev`,p);});
  }
  const levGhData=ld.impGhosts||ld.routes&&ld.routes.flatMap(r=>r.impGhosts||[])||[];
  levGhData.forEach(d=>{const g={id:d.id,name:d.name,wgs:{lat:d.wgs.lat,lng:d.wgs.lng}};g.marker=makeImpGhostMarker(`lev`,g);M.lev.impGhosts.push(g);});
  const gid={};M.gnss.pts.forEach(p=>gid[p.id]=p);
  (sp.modes.gnss.edges||[]).forEach(([a,b])=>{const pa=gid[a],pb=gid[b];if(pa&&pb)M.gnss.edges.push({a:pa,b:pb});});
  (sp.modes.gnss.triangles||[]).forEach(t=>{const ps=t.pts.map(id=>gid[id]);if(ps.every(x=>x))M.gnss.triangles.push({pts:ps,note:t.note||``});});
  (sp.notes||[]).forEach(d=>{const n={id:d.id,text:d.text||``,dim:!!d.dim,wgs:{lat:d.wgs.lat,lng:d.wgs.lng}};n.marker=makeNoteMarker(n);n.marker.addTo(map);M.notes.push(n);});
  let mx=sp.uid||0;
  M.gnss.pts.forEach(p=>mx=Math.max(mx,p.id));M.gnss.impGhosts.forEach(g=>mx=Math.max(mx,g.id));
  M.trav.routes.forEach(r=>{r.pts.forEach(p=>mx=Math.max(mx,p.id));mx=Math.max(mx,r.id);});
  M.trav.impGhosts.forEach(g=>mx=Math.max(mx,g.id));
  M.lev.routes.forEach(r=>{r.pts.forEach(p=>mx=Math.max(mx,p.id));mx=Math.max(mx,r.id);});
  M.lev.impGhosts.forEach(g=>mx=Math.max(mx,g.id));
  M.notes.forEach(n=>mx=Math.max(mx,n.id));
  uid=mx;
  cur=sp.cur||cur;setTabUI();buildParams();refresh();
  if(sp.bookmarks){bookmarks=sp.bookmarks.map(b=>({name:b.name,lat:b.lat,lng:b.lng,zoom:b.zoom}));saveBm();renderBm();}
  if(sp.mapView){map.setView(displayLL({lat:sp.mapView.lat,lng:sp.mapView.lng}),sp.mapView.zoom);}else{const allPts=[...M.gnss.pts,...allTravPts(),...allLevPts()];if(allPts.length){const bounds=allPts.map(p=>[displayLL(p.wgs).lat,displayLL(p.wgs).lng]);map.fitBounds(bounds,{padding:[50,50],maxZoom:16});}}
}
function pushUndo(){const sp=serialize();if(lastSavedMapView&&sp.mapView){const mv=sp.mapView,lm=lastSavedMapView;if(Math.abs(mv.lat-lm.lat)>1e-5||Math.abs(mv.lng-lm.lng)>1e-5||mv.zoom!==lm.zoom){undoStack.push({...sp,mapView:{...lm}});if(undoStack.length>80)undoStack.shift();}}undoStack.push(sp);if(undoStack.length>80)undoStack.shift();lastSavedMapView=sp.mapView?{...sp.mapView}:null;redoStack=[];updateUndoButtons();}
function doUndo(){if(!undoStack.length){toast(`没有可撤销的操作`);return;}redoStack.push(serialize());const sp=undoStack.pop();restore(sp);lastSavedMapView=sp.mapView?{...sp.mapView}:null;updateUndoButtons();}
function doRedo(){if(!redoStack.length){toast(`没有可重做的操作`);return;}undoStack.push(serialize());const sp=redoStack.pop();restore(sp);lastSavedMapView=sp.mapView?{...sp.mapView}:null;updateUndoButtons();}
function updateUndoButtons(){document.getElementById(`undoBtn`).disabled=!undoStack.length;document.getElementById(`redoBtn`).disabled=!redoStack.length;}
document.getElementById(`undoBtn`).onclick=doUndo;
document.getElementById(`redoBtn`).onclick=doRedo;
document.getElementById(`resetAllBtn`).onclick=()=>{pushUndo();clearAll();refresh();toast(`已清空全部模式`);};
document.addEventListener(`keydown`,e=>{const tag=(document.activeElement&&document.activeElement.tagName)||``;if(tag===`INPUT`||tag===`TEXTAREA`)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()===`z`){e.preventDefault();if(e.shiftKey)doRedo();else doUndo();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()===`y`){e.preventDefault();doRedo();}});
