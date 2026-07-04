/* ===== 标记与交互 ===== */
let _dragging=false;
let noteMode=false;
const ctrlObj={active:false,items:[],mode:null,suppress:false,snap:null,marker:null,commitMarker:null,commitLatLng:null};
const CTRL_SNAP_SHOW=18,CTRL_SNAP_HIT=8,EDGE_TOUCH_HIT=22;
function isMobileLayout(){return window.matchMedia&&window.matchMedia(`(max-width:760px)`).matches;}
function edgeTouchEnabled(){return isMobileLayout()&&(ctrlObj.active||calc.on);}
function ctrlObjectStatus(text){
  const el=document.getElementById(`ctrlObjectHint`);
  const label=el&&el.querySelector(`span`);
  if(label)label.textContent=text||`按住 Ctrl 选择对象`;
  if(el)el.classList.toggle(`active`,!!text);
  const sw=document.getElementById(`mobileCtrlSwitch`);
  if(sw)sw.checked=!!text;
}
function ctrlObjectPointSelected(p){return ctrlObj.active&&ctrlObj.items.some(x=>x.type===`point`&&x.point===p);}
function ctrlObjectEdgeSelected(mode,route,segIdx,a,b){
  if(!ctrlObj.active)return false;
  return ctrlObj.items.some(x=>{
    if(x.type!==`edge`||x.mode!==mode)return false;
    if(mode===`gnss`)return (x.a===a&&x.b===b)||(x.a===b&&x.b===a);
    return x.route===route&&x.segIdx===segIdx;
  });
}
function ctrlObjectBegin(){
  if(ctrlObj.active)return;
  if(typeof hideHelp===`function`)hideHelp();
  if(map&&map._popup){map.closePopup(map._popup);document.querySelectorAll(`.leaflet-popup`).forEach(p=>p.remove());}
  if(typeof ctxMenu!==`undefined`&&ctxMenu&&ctxMenu.style.display===`block`&&typeof hideCtx===`function`)hideCtx();
  if(typeof floatOpen!==`undefined`&&floatOpen){floatOpen=null;document.querySelectorAll(`.float-popup`).forEach(p=>p.classList.remove(`open`));}
  ctrlObjectHideCommitMarker();
  ctrlObj.active=true;ctrlObj.items=[];ctrlObj.mode=cur;ctrlObj.suppress=false;
  ctrlObjectStatus(`Ctrl 选择对象中`);
  refresh();
}
function ctrlObjectHideSnap(){
  ctrlObj.snap=null;
  if(ctrlObj.marker){map.removeLayer(ctrlObj.marker);ctrlObj.marker=null;}
}
function ctrlObjectHideCommitMarker(){
  ctrlObj.commitLatLng=null;
  if(ctrlObj.commitMarker){map.removeLayer(ctrlObj.commitMarker);ctrlObj.commitMarker=null;}
}
function ctrlObjectItemLatLng(item){
  if(!item)return null;
  if(item.type===`point`)return item.point.marker.getLatLng();
  if(item.latlng)return item.latlng;
  if(item.type===`edge`&&item.a&&item.b){
    const A=item.a.marker.getLatLng(),B=item.b.marker.getLatLng();
    return L.latLng((A.lat+B.lat)/2,(A.lng+B.lng)/2);
  }
  return null;
}
function ctrlObjectUpdateCommitMarker(){
  if(!isMobileLayout()||!ctrlObj.active||!ctrlObj.items.length){ctrlObjectHideCommitMarker();return;}
  const ll=ctrlObjectItemLatLng(ctrlObj.items[ctrlObj.items.length-1]);
  if(!ll){ctrlObjectHideCommitMarker();return;}
  ctrlObj.commitLatLng=ll;
  const icon=L.divIcon({className:``,html:`<div class="ctrl-commit-marker">✓</div>`,iconSize:[18,18],iconAnchor:[-6,21]});
  if(!ctrlObj.commitMarker){
    ctrlObj.commitMarker=L.marker(ll,{icon,zIndexOffset:2400,interactive:true,bubblingMouseEvents:false}).addTo(map);
    ctrlObj.commitMarker.on(`click`,ev=>{if(ev)L.DomEvent.stopPropagation(ev);ctrlObjectCommitAndRestart();});
  }else{
    ctrlObj.commitMarker.setLatLng(ll);ctrlObj.commitMarker.setIcon(icon);
  }
}
function ctrlObjectCancel(){
  if(!ctrlObj.active)return;
  ctrlObj.active=false;ctrlObj.items=[];ctrlObj.mode=null;ctrlObj.suppress=false;ctrlObjectHideSnap();ctrlObjectHideCommitMarker();
  ctrlObjectStatus();
  refresh();
}
function ctrlObjectAddPoint(mode,p,route){
  if(!ctrlObj.active||ctrlObj.mode!==cur)return false;
  if(mode!==cur)return false;
  const hit=ctrlObj.items.find(x=>x.type===`point`&&x.point===p);
  if(hit)ctrlObj.items=ctrlObj.items.filter(x=>x!==hit);
  else ctrlObj.items.push({type:`point`,mode,point:p,route:route||null});
  ctrlObjectStatus(`已选 `+ctrlObj.items.length+` 个对象`);
  ctrlObjectUpdateCommitMarker();
  refreshIcons(mode);
  return true;
}
function ctrlObjectAddEdge(mode,route,segIdx,a,b,latlng){
  if(!ctrlObj.active||ctrlObj.mode!==cur)return false;
  if(mode!==cur)return false;
  const hit=ctrlObj.items.find(x=>{
    if(x.type!==`edge`||x.mode!==mode)return false;
    if(mode===`gnss`)return (x.a===a&&x.b===b)||(x.a===b&&x.b===a);
    return x.route===route&&x.segIdx===segIdx;
  });
  if(hit)ctrlObj.items=ctrlObj.items.filter(x=>x!==hit);
  else ctrlObj.items.push({type:`edge`,mode,route:route||null,segIdx,a,b,latlng:latlng||null});
  ctrlObjectStatus(`已选 `+ctrlObj.items.length+` 个对象`);
  ctrlObjectUpdateCommitMarker();
  refresh();
  return true;
}
function edgeLabel(e){
  if(e.mode===`gnss`)return `GNSS 基线 `+label(`gnss`,M.gnss.pts.indexOf(e.a))+`-`+label(`gnss`,M.gnss.pts.indexOf(e.b));
  const saved=M[e.mode].activeRouteId;
  if(e.route)M[e.mode].activeRouteId=e.route.id;
  const ia=e.route?e.route.pts.indexOf(e.a):-1,ib=e.route?e.route.pts.indexOf(e.b):-1;
  const text=ROUTE_LABEL[e.mode]+` `+(e.route?e.route.name+` · `:``)+label(e.mode,ia)+`-`+label(e.mode,ib);
  M[e.mode].activeRouteId=saved;
  return text;
}
function samePointSet(a,b){
  if(a.length!==b.length)return false;
  const s=new Set(a.map(p=>p.id));
  return b.every(p=>s.has(p.id));
}
function triangleIndex(pts){
  return M.gnss.triangles.findIndex(t=>samePointSet(t.pts,pts));
}
function toggleGnssTriangle(pts){
  const g=M.gnss;
  if(pts.length!==3)return false;
  const idx=triangleIndex(pts);
  pushUndo();
  if(idx>=0){g.triangles.splice(idx,1);refresh();toast(`已取消三角网`);return true;}
  ensureEdge(pts[0],pts[1]);ensureEdge(pts[1],pts[2]);ensureEdge(pts[2],pts[0]);
  g.triangles.push({pts:[pts[0],pts[1],pts[2]],note:``});
  refresh();toast(`已添加三角网 `+circ(g.triangles.length));
  return true;
}
function commitCtrlGnss(items){
  const pts=items.filter(x=>x.type===`point`).map(x=>x.point);
  const edges=items.filter(x=>x.type===`edge`);
  if(items.length===2&&pts.length===2){pushUndo();const existed=M.gnss.edges.some(e=>(e.a===pts[0]&&e.b===pts[1])||(e.a===pts[1]&&e.b===pts[0]));toggleEdge(pts[0],pts[1]);refresh();toast(existed?`已取消基线`:`已连边`);return;}
  if(items.length===3&&pts.length===3){toggleGnssTriangle(pts);return;}
  if(items.length===3&&edges.length===3){
    const ep=[];edges.forEach(e=>{ep.push(e.a,e.b);});
    const uniq=[...new Map(ep.map(p=>[p.id,p])).values()];
    if(uniq.length===3){toggleGnssTriangle(uniq);return;}
  }
  if(items.length===2&&edges.length===1&&pts.length===1){
    const e=edges[0],p=pts[0];
    if(p!==e.a&&p!==e.b){toggleGnssTriangle([e.a,e.b,p]);return;}
  }
  toast(`GNSS：请选择两点连边，三点/三边/一边一点切换三角网`);
}
function commitCtrlRoute(mode,items){
  const pts=items.filter(x=>x.type===`point`);
  if(!pts.length)return;
  const route=pts[0].route;
  if(!route||route.locked){toast(ROUTE_LABEL[mode]+`已锁定或未选中路线`);return;}
  if(pts.some(x=>x.route!==route)){toast(`请选择同一条`+ROUTE_LABEL[mode]+`上的点`);return;}
  if(pts.length<2)return;
  const ordered=pts.map(x=>x.point);
  const firstIdx=route.pts.indexOf(ordered[0]);
  if(firstIdx<0)return;
  const selected=new Set(ordered);
  const base=route.pts.filter(p=>!selected.has(p));
  const insertAt=route.pts.slice(0,firstIdx).filter(p=>!selected.has(p)).length;
  pushUndo();
  route.pts=[...base.slice(0,insertAt),...ordered,...base.slice(insertAt)];
  refresh();
  toast(`已按选择顺序重连 `+ordered.length+` 个点`);
}
function ctrlObjectCommit(){
  if(!ctrlObj.active)return;
  const items=ctrlObj.items.slice(),mode=ctrlObj.mode,suppress=ctrlObj.suppress;
  ctrlObj.active=false;ctrlObj.items=[];ctrlObj.mode=null;ctrlObj.suppress=false;ctrlObjectHideSnap();ctrlObjectHideCommitMarker();ctrlObjectStatus();
  refresh();
  if(suppress||!items.length)return;
  if(mode===`gnss`)commitCtrlGnss(items);
  else if(mode===`trav`||mode===`lev`)commitCtrlRoute(mode,items);
}
function ctrlObjectCommitAndRestart(){
  if(!ctrlObj.active)return;
  const hadItems=ctrlObj.items.length>0;
  ctrlObjectCommit();
  if(hadItems&&isMobileLayout())ctrlObjectBegin();
}
function projectPointToSegment(P,A,B){
  const ax=A.x,ay=A.y,bx=B.x,by=B.y,px=P.x,py=P.y;
  const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy;
  if(!len2)return {x:ax,y:ay,d:Math.hypot(px-ax,py-ay),t:0};
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len2));
  const x=ax+t*dx,y=ay+t*dy;
  return {x,y,d:Math.hypot(px-x,py-y),t};
}
function ctrlObjectEdges(){
  const edges=[];
  if(cur===`gnss`){
    M.gnss.edges.forEach(e=>edges.push({mode:`gnss`,route:null,segIdx:null,a:e.a,b:e.b,action:null}));
  }else if(cur===`trav`||cur===`lev`){
    const route=activeRouteOf(cur);
    if(route&&!route.hidden&&!route.locked){
      for(let i=0;i<route.pts.length-1;i++)edges.push({mode:cur,route,segIdx:i,a:route.pts[i],b:route.pts[i+1]});
      if(route.closed&&route.pts.length>=3)edges.push({mode:cur,route,segIdx:route.pts.length-1,a:route.pts[route.pts.length-1],b:route.pts[0]});
    }
  }
  return edges;
}
function edgeCandidatesAtLatLng(latlng,radius){
  const p=map.latLngToLayerPoint(latlng),hits=[];
  ctrlObjectEdges().forEach(e=>{
    if(!map.hasLayer(e.a.marker)||!map.hasLayer(e.b.marker))return;
    const A=map.latLngToLayerPoint(e.a.marker.getLatLng()),B=map.latLngToLayerPoint(e.b.marker.getLatLng());
    const pr=projectPointToSegment(p,A,B);
    if(pr.d<=radius)hits.push({...e,d:pr.d,latlng:map.layerPointToLatLng(L.point(pr.x,pr.y))});
  });
  hits.sort((a,b)=>a.d-b.d);
  return hits;
}
function ctrlObjectUpdateSnap(latlng){
  if(!ctrlObj.active||ctrlObj.mode!==cur){ctrlObjectHideSnap();return;}
  const p=map.latLngToLayerPoint(latlng);
  const nearPoint=(()=>{
    const pts=cur===`gnss`?M.gnss.pts:(activeRouteOf(cur)?activeRouteOf(cur).pts:[]);
    return pts.some(pt=>map.hasLayer(pt.marker)&&p.distanceTo(map.latLngToLayerPoint(pt.marker.getLatLng()))<=16);
  })();
  if(nearPoint){ctrlObjectHideSnap();return;}
  const best=edgeCandidatesAtLatLng(latlng,CTRL_SNAP_SHOW)[0]||null;
  if(best)best.hit=best.d<=CTRL_SNAP_HIT;
  if(!best){ctrlObjectHideSnap();return;}
  ctrlObj.snap=best;
  const html=`<div class="ctrl-snap-marker`+(best.hit?` hit`:``)+`"></div>`;
  const icon=L.divIcon({className:``,html,iconSize:[18,18],iconAnchor:[9,9]});
  if(!ctrlObj.marker){
    ctrlObj.marker=L.marker(best.latlng,{icon,interactive:false}).addTo(map);
  }else{
    ctrlObj.marker.setLatLng(best.latlng);ctrlObj.marker.setIcon(icon);
  }
}
function ctrlObjectUseSnap(){
  const s=ctrlObj.snap;
  if(!ctrlObj.active||!s||!s.hit)return false;
  if(s.mode===`gnss`)return ctrlObjectAddEdge(`gnss`,null,null,s.a,s.b,s.latlng);
  ctrlObj.suppress=true;
  const ev={latlng:s.latlng};
  if(calc.on){toggleCalc(s.mode,s.a.id,s.b.id);return true;}
  if(s.mode===`trav`){showSegPopup(`trav`,s.segIdx,ev,s.route);return true;}
  if(s.mode===`lev`){
    if(s.a.knownEdgeAfter){toast(`水准已知边不可编辑`);return true;}
    if(s.route.linkedRouteId)showTurnPopup(s.route,s.segIdx,ev);
    else showSegPopup(`lev`,s.segIdx,ev,s.route);
    return true;
  }
  return false;
}
function useEdgeCandidate(s){
  if(!s)return false;
  if(ctrlObj.active){
    if(s.mode===`gnss`)return ctrlObjectAddEdge(`gnss`,null,null,s.a,s.b,s.latlng);
    ctrlObj.suppress=true;
    const ev={latlng:s.latlng};
    if(calc.on){toggleCalc(s.mode,s.a.id,s.b.id);return true;}
    if(s.mode===`trav`){showSegPopup(`trav`,s.segIdx,ev,s.route);return true;}
    if(s.mode===`lev`){
      if(s.a.knownEdgeAfter){toast(`水准已知边不可编辑`);return true;}
      if(s.route.linkedRouteId)showTurnPopup(s.route,s.segIdx,ev);
      else showSegPopup(`lev`,s.segIdx,ev,s.route);
      return true;
    }
  }else if(calc.on){
    toggleCalc(s.mode,s.a.id,s.b.id);
    return true;
  }
  return false;
}
async function chooseEdgeCandidate(hits){
  if(!hits.length)return null;
  if(hits.length===1)return hits[0];
  const shown=hits.slice(0,5);
  const rows=shown.map((h,i)=>`<div class="row"><span class="lab">`+(i+1)+`. `+edgeLabel(h)+`</span><span class="val">距触点 `+h.d.toFixed(0)+` px</span></div>`).join(``);
  const buttons=[{text:`取消`,value:`cancel`}].concat(shown.map((h,i)=>({text:String(i+1),value:String(i),cls:i===0?`go`:``})));
  const r=await showConfirm(`选择要操作的边`,`<p class="note" style="margin-top:0">点击范围内有多个要素，请选择一个。</p>`+rows,buttons);
  if(!r||r.action===`cancel`)return null;
  return shown[parseInt(r.action,10)]||null;
}
async function handleExpandedEdgeClick(latlng){
  if(!edgeTouchEnabled())return false;
  const hits=edgeCandidatesAtLatLng(latlng,EDGE_TOUCH_HIT);
  if(!hits.length)return false;
  const picked=await chooseEdgeCandidate(hits);
  if(picked)useEdgeCandidate(picked);
  return true;
}
function isTerminal(mode,i){
  if(mode===`trav`||mode===`lev`){const r=activeRouteOf(mode);if(!r||r.closed)return false;return i===0||i===r.pts.length-1;}
  return false;
}
function makeIcon(mode,i,opts){
  opts=opts||{};const M0=M[mode],nm=label(mode,i),p=M0.pts[i],kind=p?p.kind:`new`;const sel=opts.sel?` sel`:``;const inactive=opts.inactive?` inactive`:``;
  if(kind===`known`){const link=(p&&p.link)?` link`:``;return L.divIcon({className:``,html:`<div class="pt-known`+sel+link+inactive+`"><svg width="22" height="19" viewBox="0 0 22 19"><polygon points="11,1.5 20.5,17.5 1.5,17.5" fill="#ff5a3c" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><span class="known-nm">`+nm+`</span></div>`,iconSize:[60,34],iconAnchor:[30,11]});}
  if(kind===`turn`){return L.divIcon({className:``,html:`<div class="pt-turn`+sel+inactive+`">`+nm+`</div>`,iconSize:[0,0],iconAnchor:[0,0]});}
  const term=opts.term?` term`:``,sync=(p&&p.sync)?` sync`:``,anchor=opts.anchor?` anchor`:``;
  return L.divIcon({className:``,html:`<div class="pt-label `+M0.cls+term+sync+sel+inactive+anchor+`">`+nm+`</div>`,iconSize:[0,0],iconAnchor:[0,0]});
}
function refreshIcons(mode){
  if(_dragging)return;
  if(mode===`trav`||mode===`lev`){
    const savedId=M[mode].activeRouteId;
    M[mode].routes.forEach(route=>{
      M[mode].activeRouteId=route.id;
      route.pts.forEach((p,i)=>p.marker.setIcon(makeIcon(mode,i,{term:isTerminal(mode,i),anchor:!!route.parentId&&i===0,sel:ctrlObjectPointSelected(p)})));
    });
    M[mode].activeRouteId=savedId;
  }else{
    M[mode].pts.forEach((p,i)=>p.marker.setIcon(makeIcon(mode,i,{term:isTerminal(mode,i),sel:ctrlObjectPointSelected(p)||M.gnss.triSel.includes(p)})));
  }
}
function delAction(mode,p){
  if(p.fromImpGhost&&!p.link)return{text:`退`,title:`退回可用控制点`,fn(){pushUndo();revertToGhost(mode,p);toast(`已退回可用控制点`);}};
  return{text:p.link?`移`:`删`,title:p.link?`从导线移除`:`删除`,fn(){pushUndo();removePoint(mode,p);}};
}
function bindMarker(mode,p){
  p.marker.off();
  if(p.marker._tooltip)p.marker.unbindTooltip();
  function ownerRoute(){
    if(mode===`trav`)return M.trav.routes.find(r=>r.pts.includes(p));
    if(mode===`lev`)return M.lev.routes.find(r=>r.pts.includes(p));
    return null;
  }
  if(!p.link){p.marker.on(`dragstart`,()=>{_dragging=true;pushUndo();});p.marker.on(`drag`,()=>{p.wgs=trueLL(p.marker.getLatLng());refresh();});p.marker.on(`dragend`,()=>{_dragging=false;refreshIcons(mode);});}
  p.marker.on(`click`,ev=>{
    if(ev)L.DomEvent.stopPropagation(ev);
    if(calc.on)return;
    if(ctrlObj.active&&ctrlObjectAddPoint(mode,p,ownerRoute()))return;
    if(mode===`gnss`){
      const i=M.gnss.pts.indexOf(p);
      if(M.gnss.sub===`edge`){const g=M.gnss;if(!g.sel){g.sel=p;p.marker.setIcon(makeIcon(`gnss`,i,{sel:true}));}else if(g.sel===p){g.sel=null;refreshIcons(`gnss`);}else{pushUndo();toggleEdge(g.sel,p);g.sel=null;refresh();}return;}
      if(M.gnss.sub===`tri`){selectTriVertex(p);return;}
      return;
    }
    const ar=activeRouteOf(mode);
    if(!ar){toast(`请先创建或选中一条`+ROUTE_LABEL[mode]);return;}
    if(ar.locked){toast(ROUTE_LABEL[mode]+`已锁定`);return;}
    if(ar.pts.includes(p))return;
    const THRESH=1e-6;
    if(ar.pts.some(q=>Math.abs(q.wgs.lat-p.wgs.lat)<THRESH&&Math.abs(q.wgs.lng-p.wgs.lng)<THRESH)){toast(`当前路线已包含该点`);return;}
    pushUndo();
    const np={id:++uid,kind:p.kind,name:p.name,wgs:{lat:p.wgs.lat,lng:p.wgs.lng},sync:false,link:p.link||null};
    if(p.link)np.indepName=!!p.indepName;
    np.marker=L.marker(displayLL(np.wgs),{draggable:!ar.locked}).addTo(map);
    ar.pts.push(np);bindMarker(mode,np);refresh();
    toast(`已加入：`+(p.name||`控制点`));
  });
  function showEditPopup(e){
    if(e){L.DomEvent.stopPropagation(e);L.DomEvent.preventDefault(e);}
    if(calc.on)return;
    const or=ownerRoute();
    let idx,lbl;
    if(mode===`gnss`){idx=M.gnss.pts.indexOf(p);lbl=label(`gnss`,idx>=0?idx:0);}
    else{idx=or?or.pts.indexOf(p):0;const sid=M[mode].activeRouteId;if(or)M[mode].activeRouteId=or.id;lbl=label(mode,idx>=0?idx:0);M[mode].activeRouteId=sid;}
    const isLocked=or&&or.locked;
    const div=document.createElement(`div`);div.style.textAlign=`center`;
    const originalName=p.name||``;
    const originalDisplay=p.name||lbl;
    const nameInp=document.createElement(`input`);nameInp.type=`text`;nameInp.value=originalDisplay;
    nameInp.style.cssText=`width:100%;padding:4px 8px;border:1px solid var(--line);border-radius:4px;background:var(--panel2);color:var(--text);font-size:13px;text-align:center;font-weight:600;margin-bottom:6px;`;
    if(isLocked)nameInp.disabled=true;
    let skipNameCommit=false;
    function commitName(){
      if(skipNameCommit||isLocked)return;
      const v=nameInp.value.trim();
      if(!v)return;
      if(!originalName&&v===originalDisplay)return;
      if(v!==originalName){pushUndo();p.name=v;if(p.link)p.indepName=true;refresh();}
    }
    nameInp.onkeydown=ev=>{
      if(ev.key===`Enter`){ev.preventDefault();commitName();skipNameCommit=true;map.closePopup();}
      else if(ev.key===`Escape`){ev.preventDefault();ev.stopPropagation();if(nameInp.value!==originalDisplay)nameInp.value=originalDisplay;else{skipNameCommit=true;map.closePopup();}}
    };
    div.appendChild(nameInp);
    if(p.kind===`turn`){
      const infoT=document.createElement(`div`);infoT.style.cssText=`font-size:12px;color:var(--muted);margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px;`;infoT.textContent=`转点`;
      if(!isLocked){const li=document.createElement(`span`);li.className=`gps-locate-icon`;li.title=`GPS采样定位`;li.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;li.onclick=function(ev){ev.stopPropagation();if(li.classList.contains(`sampling`))return;li.classList.add(`sampling`);map.closePopup();toast(`采样中 0/5…`);gpsMultiSample(function(r){if(!r)return;pushUndo();p.wgs={lat:r.lat,lng:r.lng};p.marker.setLatLng(displayLL(p.wgs));map.panTo(displayLL(p.wgs));refresh();toast(`已定位（精度 `+r.accuracy.toFixed(1)+`m，采样`+r.n+`次，有效`+r.used+`次）`);},function(n,t){toast(`采样中 `+n+`/`+t+`…`);});};infoT.appendChild(li);}
      div.appendChild(infoT);
      if(!isLocked){const db=document.createElement(`button`);db.className=`del-popup-btn`;db.textContent=`删除转点`;db.onclick=()=>{map.closePopup();pushUndo();removePoint(`lev`,p);};div.appendChild(db);}
      const pop=L.popup({offset:[0,-8]}).setLatLng(p.marker.getLatLng()).setContent(div).openOn(map);
      pop.on(`remove`,commitName);
      return;
    }
    const isLevLinked=mode===`lev`&&p.link&&or&&or.linkedRouteId;
    const typeText=p.link?(isLevLinked?`同步自导线`:`同步自GNSS`):(p.kind===`known`?`已知点`:`待测点`);
    const infoDiv=document.createElement(`div`);infoDiv.style.cssText=`font-size:12px;color:var(--muted);margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px;`;infoDiv.textContent=typeText;
    if(!p.link&&!isLocked){const li=document.createElement(`span`);li.className=`gps-locate-icon`;li.title=`GPS采样定位`;li.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;li.onclick=function(ev){ev.stopPropagation();if(li.classList.contains(`sampling`))return;li.classList.add(`sampling`);map.closePopup();toast(`采样中 0/5…`);gpsMultiSample(function(r){if(!r)return;pushUndo();p.wgs={lat:r.lat,lng:r.lng};p.marker.setLatLng(displayLL(p.wgs));map.panTo(displayLL(p.wgs));refresh();toast(`已定位（精度 `+r.accuracy.toFixed(1)+`m，采样`+r.n+`次，有效`+r.used+`次）`);},function(n,t){toast(`采样中 `+n+`/`+t+`…`);});};infoDiv.appendChild(li);}
    div.appendChild(infoDiv);
    if(!p.link&&!isLocked){
      const kb=document.createElement(`button`);kb.className=`kind-popup-btn`;kb.textContent=p.kind===`known`?`改为待测点`:`改为已知点`;kb.onclick=()=>{map.closePopup();pushUndo();p.kind=p.kind===`known`?`new`:`known`;refresh();};div.appendChild(kb);
      if(mode===`gnss`){const sb=document.createElement(`button`);sb.className=`kind-popup-btn`;sb.textContent=p.sync?`取消供导线使用`:`供导线使用`;sb.onclick=()=>{map.closePopup();pushUndo();p.sync=!p.sync;refresh();};div.appendChild(sb);}
    }
    if((mode===`trav`||mode===`lev`)&&or&&!isLocked){
      if(or.pts.indexOf(p)===0&&or.pts.length>=3){
        const cb=document.createElement(`button`);cb.className=`kind-popup-btn`;cb.textContent=or.closed?`取消闭合`:`闭合路线`;
        cb.onclick=()=>{map.closePopup();pushUndo();or.closed=!or.closed;refresh();};div.appendChild(cb);
      }
    }
    if((mode===`trav`||mode===`lev`)&&!p.link&&!isLocked){
      const ml=ROUTE_LABEL[mode],sml=`支`+ml;
      const spb=document.createElement(`button`);spb.className=`kind-popup-btn`;spb.textContent=`从此点创建`+sml;
      spb.onclick=async()=>{map.closePopup();const r=await showConfirm(`创建`+sml,`<div class="param"><span>`+sml+`名称</span><input data-key="name" type="text" value="`+sml+(M[mode].routes.length+1)+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div><div class="param"><span>点名前缀</span><input data-key="prefix" type="text" placeholder="可选" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`,[{text:`取消`,value:`cancel`},{text:`创建`,value:`create`,cls:`go`}]);if(!r||r.action===`cancel`)return;const nm=r.inputs.name||sml+(M[mode].routes.length+1);const pfx=r.inputs.prefix||``;pushUndo();const pr=ownerRoute();const route=createRouteOf(mode,nm,pfx,pr?pr.id:null);const sp={id:++uid,kind:p.kind,name:p.name||lbl,wgs:{lat:p.wgs.lat,lng:p.wgs.lng},sync:false,link:null};sp.marker=L.marker(displayLL(sp.wgs),{draggable:true}).addTo(map);route.pts.push(sp);bindMarker(mode,sp);refresh();toast(`已创建`+sml+`「`+nm+`」`);};
      div.appendChild(spb);
    }
    if(!isLocked&&!isLevLinked){
      const db=document.createElement(`button`);db.className=`del-popup-btn`;const da=delAction(mode,p);db.textContent=da.title;db.onclick=()=>{skipNameCommit=true;map.closePopup();da.fn();};div.appendChild(db);
    }
    const pop=L.popup({offset:[0,-12]}).setLatLng(p.marker.getLatLng()).setContent(div).openOn(map);
    pop.on(`remove`,commitName);
  }
  p.marker.on(`contextmenu`,showEditPopup);
  let _lpTimer=null;
  p.marker.on(`touchstart`,()=>{_lpTimer=setTimeout(()=>{_lpTimer=null;showEditPopup();},600);});
  p.marker.on(`touchend`,()=>{if(_lpTimer){clearTimeout(_lpTimer);_lpTimer=null;}});
  p.marker.on(`touchmove`,()=>{if(_lpTimer){clearTimeout(_lpTimer);_lpTimer=null;}});
  if(!isMobileLayout())p.marker.bindTooltip(`右键编辑`,{direction:`top`,offset:[0,-10]});
}
function newPoint(mode,latlng,kind){const p={id:++uid,kind:kind||`new`,name:null,wgs:trueLL(latlng),sync:false,link:null};p.marker=L.marker(latlng,{draggable:true}).addTo(map);bindMarker(mode,p);return p;}
async function addPoint(latlng){
  if(cur===`trav`||cur===`lev`){
    const ml=ROUTE_LABEL[cur],pfxHint=cur===`trav`?`可选，如 K`:`可选，如 S`;
    if(!activeRouteOf(cur)){
      const r=await showConfirm(`创建`+ml,`<div class="param"><span>`+ml+`名称</span><input data-key="name" type="text" value="`+ml+(M[cur].routes.length+1)+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div><div class="param"><span>点名前缀</span><input data-key="prefix" type="text" placeholder="`+pfxHint+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`,[{text:`取消`,value:`cancel`},{text:`创建`,value:`create`,cls:`go`}]);
      if(!r||r.action===`cancel`)return;
      const nm=r.inputs.name||ml+(M[cur].routes.length+1);const pfx=r.inputs.prefix||``;
      pushUndo();createRouteOf(cur,nm,pfx);const p=newPoint(cur,latlng);M[cur].pts.push(p);refresh();toast(`已创建`+ml+`「`+nm+`」`);return;
    }
    if(activeRouteOf(cur).locked){toast(ml+`已锁定，无法编辑`);return;}
  }
  pushUndo();const p=newPoint(cur,latlng);M[cur].pts.push(p);refresh();
}
function nextAutoName(mode){
  const route=activeRouteOf(mode);
  if(!route)return null;
  const pfx=route.prefix||M[mode].prefix;
  if(!pfx)return null;
  const used=new Set();
  route.pts.forEach((p,i)=>{
    if(p.name&&p.name.startsWith(pfx)){const n=parseInt(p.name.slice(pfx.length),10);if(!isNaN(n))used.add(n);}
    else if(!p.name)used.add(i+1);
  });
  let n=1;while(used.has(n))n++;
  return pfx+String(n).padStart(2,`0`);
}
function insertOnSegment(mode,i,latlng){
  const route=activeRouteOf(mode);
  if(route&&route.locked){toast(ROUTE_LABEL[mode]+`已锁定`);return;}
  pushUndo();
  const sid=M[mode].activeRouteId;if(route)M[mode].activeRouteId=route.id;
  route.pts.forEach((pt,j)=>{if(!pt.name)pt.name=label(mode,j);});
  M[mode].activeRouteId=sid;
  const p=newPoint(mode,latlng);p.name=nextAutoName(mode);M[mode].pts.splice(i+1,0,p);refresh();
}
function showSegPopup(mode,segIdx,ev,route){
  const pts=route.pts;const isKE=!!pts[segIdx].knownEdgeAfter;
  const div=document.createElement(`div`);div.style.cssText=`display:flex;flex-direction:column;gap:6px;`;
  if(!isKE){
    const btnIns=document.createElement(`button`);btnIns.textContent=`在此处插入新点`;btnIns.className=`btn sm`;
    btnIns.onclick=()=>{map.closePopup();insertOnSegment(mode,segIdx,ev.latlng);};
    div.appendChild(btnIns);
    if(mode===`lev`){
      const btnTurn=document.createElement(`button`);btnTurn.textContent=`插入转点`;btnTurn.className=`btn sm`;
      btnTurn.onclick=()=>{map.closePopup();insertTurnPoint(route,segIdx,ev.latlng);};
      div.appendChild(btnTurn);
    }
  }
  if(mode===`trav`){
    const btnKE=document.createElement(`button`);btnKE.textContent=isKE?`取消已知边`:`设为已知边`;btnKE.className=`btn sm`;
    btnKE.onclick=()=>{pushUndo();pts[segIdx].knownEdgeAfter=!isKE;map.closePopup();refresh();};
    div.appendChild(btnKE);
  }
  L.popup({closeButton:true,minWidth:120}).setLatLng(ev.latlng).setContent(div).openOn(map);
}
function nextTurnName(route){
  const used=new Set();
  route.pts.forEach(p=>{if(p.kind===`turn`&&p.name&&p.name.startsWith(`Z`)){const n=parseInt(p.name.slice(1),10);if(!isNaN(n))used.add(n);}});
  let n=1;while(used.has(n))n++;return`Z`+String(n).padStart(2,`0`);
}
function insertTurnPoint(route,segIdx,latlng){
  if(route.locked){toast(`水准路线已锁定`);return;}
  pushUndo();
  const p={id:++uid,kind:`turn`,name:nextTurnName(route),wgs:trueLL(latlng),sync:false,link:null,knownEdgeAfter:false};
  p.marker=L.marker(displayLL(p.wgs),{draggable:true}).addTo(map);
  route.pts.splice(segIdx+1,0,p);bindMarker(`lev`,p);refresh();
}
function showTurnPopup(route,segIdx,ev){
  const div=document.createElement(`div`);div.style.cssText=`display:flex;flex-direction:column;gap:6px;`;
  const btnIns=document.createElement(`button`);btnIns.textContent=`插入转点`;btnIns.className=`btn sm`;
  btnIns.onclick=()=>{map.closePopup();insertTurnPoint(route,segIdx,ev.latlng);};
  div.appendChild(btnIns);
  L.popup({closeButton:true,minWidth:100}).setLatLng(ev.latlng).setContent(div).openOn(map);
}
function removePoint(mode,p){map.removeLayer(p.marker);const M0=M[mode];M0.pts=M0.pts.filter(x=>x!==p);if(mode===`gnss`){M0.edges=M0.edges.filter(e=>e.a!==p&&e.b!==p);M0.triangles=M0.triangles.filter(t=>!t.pts.includes(p));if(M0.sel===p)M0.sel=null;M0.triSel=M0.triSel.filter(x=>x!==p);}refresh();}
function toggleEdge(a,b){
  const g=M.gnss;
  const idx=g.edges.findIndex(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
  if(idx>=0){
    g.edges.splice(idx,1);
    g.triangles=g.triangles.filter(t=>!(t.pts.includes(a)&&t.pts.includes(b)));
  }else g.edges.push({a,b});
}
function repositionAll(){
  M.gnss.pts.forEach(p=>p.marker.setLatLng(displayLL(p.wgs)));M.gnss.impGhosts.forEach(g=>g.marker.setLatLng(displayLL(g.wgs)));
  M.trav.routes.forEach(route=>{route.pts.forEach(p=>p.marker.setLatLng(displayLL(p.wgs)));});
  M.trav.impGhosts.forEach(g=>g.marker.setLatLng(displayLL(g.wgs)));
  M.lev.routes.forEach(route=>{route.pts.forEach(p=>p.marker.setLatLng(displayLL(p.wgs)));});
  M.lev.impGhosts.forEach(g=>g.marker.setLatLng(displayLL(g.wgs)));
  M.trav.ghosts.forEach(g=>{if(g._wgs)g.setLatLng(displayLL(g._wgs));});
  if(typeof repositionGPSMarker==='function')repositionGPSMarker();
  ctrlObjectUpdateCommitMarker();
}
function noteIcon(n){return L.divIcon({className:``,html:`<div class="note-pin`+((ctrlObj.active||n.dim)?` inactive`:``)+`"><svg width="20" height="28" viewBox="0 0 20 28"><path d="M10 0C4.5 0 0 4.5 0 10c0 7.5 10 18 10 18s10-10.5 10-18C20 4.5 15.5 0 10 0z" fill="#ffb454" stroke="#fff" stroke-width="1.5"/><circle cx="10" cy="10" r="4" fill="#fff"/></svg>`+(n.text?`<span class="note-text">`+n.text+`</span>`:``)+`</div>`,iconSize:[0,0],iconAnchor:[0,0]});}
function makeNoteMarker(n){
  const mk=L.marker(displayLL(n.wgs),{draggable:!n.dim,icon:noteIcon(n)});
  mk.on(`dragstart`,()=>{if(ctrlObj.active||n.dim)return;_dragging=true;pushUndo();});
  mk.on(`drag`,()=>{if(ctrlObj.active||n.dim)return;n.wgs=trueLL(mk.getLatLng());});
  mk.on(`dragend`,()=>{if(ctrlObj.active||n.dim)return;_dragging=false;});
  function showNotePopup(e){
    if(e){L.DomEvent.stopPropagation(e);L.DomEvent.preventDefault(e);}
    if(ctrlObj.active||n.dim)return;
    const div=document.createElement(`div`);div.style.textAlign=`center`;
    const originalText=n.text||``;
    const inp=document.createElement(`input`);
    inp.type=`text`;inp.value=originalText;inp.placeholder=`备注文字`;
    inp.style.cssText=`width:100%;padding:4px 8px;border:1px solid var(--line);border-radius:4px;background:var(--panel2);color:var(--text);font-size:13px;text-align:center;margin-bottom:6px;`;
    let skipCommit=false;
    function commitNote(){if(skipCommit)return;const v=inp.value.trim();if(v!==originalText){pushUndo();n.text=v;mk.setIcon(noteIcon(n));refresh();}}
    inp.onkeydown=ev=>{
      if(ev.key===`Enter`){ev.preventDefault();commitNote();skipCommit=true;map.closePopup();}
      else if(ev.key===`Escape`){ev.preventDefault();ev.stopPropagation();if(inp.value!==originalText)inp.value=originalText;else{skipCommit=true;map.closePopup();}}
    };
    div.appendChild(inp);
    const db=document.createElement(`button`);db.className=`del-popup-btn`;db.textContent=`删除`;
    db.onclick=()=>{skipCommit=true;map.closePopup();pushUndo();map.removeLayer(mk);M.notes=M.notes.filter(x=>x!==n);refresh();};
    div.appendChild(db);
    const dim=document.createElement(`button`);dim.className=`kind-popup-btn`;dim.textContent=`虚化`;
    dim.onclick=()=>{skipCommit=true;pushUndo();n.text=inp.value.trim();n.dim=true;map.closePopup();refresh();toast(`图记已虚化`);};
    div.appendChild(dim);
    const pop=L.popup({offset:[0,-12]}).setLatLng(mk.getLatLng()).setContent(div).openOn(map);pop.on(`remove`,commitNote);
  }
  mk.on(`contextmenu`,showNotePopup);
  let _lp=null;
  mk.on(`touchstart`,()=>{if(ctrlObj.active||n.dim)return;_lp=setTimeout(()=>{_lp=null;showNotePopup();},600);});
  mk.on(`touchend`,()=>{if(_lp){clearTimeout(_lp);_lp=null;}});
  mk.on(`touchmove`,()=>{if(_lp){clearTimeout(_lp);_lp=null;}});
  if(!isMobileLayout())mk.bindTooltip(`右键编辑`,{direction:`top`,offset:[0,-28]});
  return mk;
}
map.on(`mousemove`,e=>ctrlObjectUpdateSnap(e.latlng));
map.on(`click`,async e=>{
  if(_popupJustClosed){_popupJustClosed=false;return;}
  if(ctrlObj.active){
    if(await handleExpandedEdgeClick(e.latlng))return;
    ctrlObjectUseSnap();
    return;
  }
  if(calc.on){
    await handleExpandedEdgeClick(e.latlng);
    return;
  }
  if(noteMode){pushUndo();const n={id:++uid,text:``,wgs:trueLL(e.latlng)};n.marker=makeNoteMarker(n);n.marker.addTo(map);M.notes.push(n);refresh();return;}
  if(cur===`gnss`){if(M.gnss.sub!==`point`)return;addPoint(e.latlng);return;}
  addPoint(e.latlng);
});


/* ===== 绘制与渲染 ===== */
function clearLines(mode){M[mode].lines.forEach(l=>map.removeLayer(l));M[mode].lines=[];}
function clearTriLayers(){M.gnss.triLayers.forEach(l=>map.removeLayer(l));M.gnss.triLayers=[];}
function drawSeg(mode,A,B,opts){
  opts=opts||{};
  const w=opts.weight||3;
  let pl;
  if(opts.knownEdge){
    const outer=L.polyline([A,B],{color:opts.color,weight:w+4,opacity:opts.opacity||.9,interactive:!!opts.onClick});
    outer.addTo(map);M[mode].lines.push(outer);
    const inner=L.polyline([A,B],{color:`#080c12`,weight:w,opacity:1,interactive:false});
    inner.addTo(map);M[mode].lines.push(inner);pl=outer;
  }else{
    pl=L.polyline([A,B],{color:opts.color,weight:w,dashArray:opts.dash||null,opacity:opts.opacity||.9,interactive:!!opts.onClick});
    pl.addTo(map);M[mode].lines.push(pl);
  }
  if(opts.onClick)pl.on(`click`,ev=>{L.DomEvent.stopPropagation(ev);opts.onClick(ev);});
  if(opts.onClick&&edgeTouchEnabled()){
    const hit=L.polyline([A,B],{color:`#ffffff`,weight:EDGE_TOUCH_HIT*2,opacity:0,interactive:true});
    hit.addTo(map);
    hit.on(`click`,async ev=>{L.DomEvent.stopPropagation(ev);await handleExpandedEdgeClick(ev.latlng);});
    M[mode].lines.push(hit);
  }
  if(opts.dist!==undefined){
    const mid=L.latLng((A.lat+B.lat)/2,(A.lng+B.lng)/2);
    M[mode].lines.push(L.marker(mid,{icon:L.divIcon({className:``,html:`<div class="dist-label`+(opts.bad?` bad`:``)+`">`+opts.dist.toFixed(1)+` m</div>`,iconSize:[0,0]}),interactive:false}).addTo(map));
  }
  return pl;
}
function calcHas(key){return calc.set.some(x=>x.key===key);}
function toggleCalc(mode,aId,bId){const key=keyOf(aId,bId);const idx=calc.set.findIndex(x=>x.key===key);if(idx>=0)calc.set.splice(idx,1);else calc.set.push({key,mode,aId,bId});refresh();}
function calcSum(){let sum=0,n=0;const keep=[];calc.set.forEach(x=>{const a=pointById(x.mode,x.aId),b=pointById(x.mode,x.bId);if(a&&b&&x.mode===cur){sum+=vincenty(a.wgs,b.wgs);n++;keep.push(x);}else if(a&&b){keep.push(x);}});return {sum,n};}

function refresh(){
  reconcileLinks();
  [`gnss`,`trav`,`lev`].forEach(mode=>{
    refreshIcons(mode);
    if(mode===`trav`||mode===`lev`){
      M[mode].routes.forEach(route=>{
        route.pts.forEach(p=>{
          const sd=!p.link&&!route.locked;if(sd){if(p.marker.dragging)p.marker.dragging.enable();}else{if(p.marker.dragging)p.marker.dragging.disable();}
          if(mode===cur&&!route.hidden){if(!map.hasLayer(p.marker))p.marker.addTo(map);}
          else{if(map.hasLayer(p.marker))map.removeLayer(p.marker);}
        });
      });
    }else{
      M[mode].pts.forEach(p=>{if(mode===cur){if(!map.hasLayer(p.marker))p.marker.addTo(map);}else if(map.hasLayer(p.marker))map.removeLayer(p.marker);});
    }
    M[mode].impGhosts.forEach(g=>{if(mode===cur){if(!map.hasLayer(g.marker))g.marker.addTo(map);}else if(map.hasLayer(g.marker))map.removeLayer(g.marker);});
  });
  clearLines(`gnss`);clearLines(`trav`);clearLines(`lev`);clearTriLayers();buildGhosts();
  M.notes.forEach(n=>{n.marker.setIcon(noteIcon(n));if(n.marker.dragging){if(ctrlObj.active||n.dim)n.marker.dragging.disable();else n.marker.dragging.enable();}if(!map.hasLayer(n.marker))n.marker.addTo(map);});
  renderPtList();renderCalc();
  if(typeof renderNoteList===`function`)renderNoteList();
  if(cur===`gnss`)refreshGnss();else if(cur===`trav`)refreshTrav();else refreshLev();
  ctrlObjectUpdateCommitMarker();
  updateUndoButtons();
}
